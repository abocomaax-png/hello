import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  ShieldCheck,
  ShieldX,
  Trash2,
  Upload,
} from "lucide-react";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import type { Scenario } from "@/integrations/firebase/types";
import type { User } from "firebase/auth";
import { PageHeader, Panel } from "../dashboard";
import { Toaster } from "@/components/ui/sonner";
import { parseLogFile, type ParsedLogLine } from "@/lib/log-parser";

export const Route = createFileRoute("/_authenticated/admin/scenarios")({
  head: () => ({
    meta: [
      { title: "Scenario Builder · ti3lab" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminScenarios,
});

type DraftRow = ParsedLogLine & {
  is_malicious: boolean;
  mitre: string;
  explanation: string;
};

type QuestionDraft = {
  key: string;
  text: string;
  hint: string;
  answer: string;
};

const ADMIN_EMAIL = "abocomaax@gmail.com";

let questionKeySeq = 0;
function newQuestionDraft(): QuestionDraft {
  questionKeySeq += 1;
  return {
    key: `q${Date.now()}_${questionKeySeq}`,
    text: "",
    hint: "",
    answer: "",
  };
}

function AdminScenarios() {
  const { user } = Route.useRouteContext() as { user: User };
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = (user.email ?? "").toLowerCase() === ADMIN_EMAIL;

  const { data: scenarios, isLoading: loadingScenarios } = useQuery({
    queryKey: ["admin-scenarios"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "scenarios"), orderBy("createdAt", "desc")),
      );
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Scenario) }));
    },
    enabled: isAdmin,
  });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [sourceLabel, setSourceLabel] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    newQuestionDraft(),
  ]);

  const maliciousCount = useMemo(
    () => rows.filter((r) => r.is_malicious).length,
    [rows],
  );

  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) => {
    setQuestions((qs) =>
      qs.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );
  };
  const addQuestion = () => setQuestions((qs) => [...qs, newQuestionDraft()]);
  const removeQuestion = (key: string) =>
    setQuestions((qs) =>
      qs.length > 1 ? qs.filter((q) => q.key !== key) : qs,
    );

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseLogFile(file.name, text);
      if (parsed.length === 0) {
        toast.error("No log lines found in that file");
        return;
      }
      setRows(
        parsed.map((p) => ({
          ...p,
          is_malicious: false,
          mitre: "",
          explanation: "",
        })),
      );
      setFileName(file.name);
      toast.success(`Parsed ${parsed.length} log lines from ${file.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse file");
    }
  };

  const publish = async () => {
    if (!title.trim() || !slug.trim()) {
      toast.error("Title and slug are required");
      return;
    }
    if (rows.length === 0) {
      toast.error("Upload a log file first");
      return;
    }
    if (maliciousCount === 0) {
      toast.error(
        "Mark at least one line as malicious — an answer key with zero positives can't be graded meaningfully",
      );
      return;
    }
    const validQuestions = questions.filter(
      (q) => q.text.trim() && q.answer.trim(),
    );
    if (validQuestions.length === 0) {
      toast.error("Add at least one debrief question with an answer");
      return;
    }

    setSaving(true);
    try {
      const scenarioRef = doc(collection(db, "scenarios"));
      const logsCol = collection(db, "scenarios", scenarioRef.id, "logs");
      const answersCol = collection(db, "scenarios", scenarioRef.id, "answers");
      const questionsCol = collection(
        db,
        "scenarios",
        scenarioRef.id,
        "questions",
      );
      const questionAnswersCol = collection(
        db,
        "scenarios",
        scenarioRef.id,
        "questionAnswers",
      );

      // Firestore batches cap at 500 writes; chunk defensively.
      const chunks: DraftRow[][] = [];
      for (let i = 0; i < rows.length; i += 200)
        chunks.push(rows.slice(i, i + 200));

      // Phase 1: write everything with isPublished: false. The scenario
      // (and every log/question) only becomes visible to trainees once the
      // isPublished flip in phase 2 below succeeds, so a failure partway
      // through phase 1 never leaves half-written data exposed.
      for (const [chunkIndex, chunk] of chunks.entries()) {
        const batch = writeBatch(db);
        if (chunkIndex === 0) {
          batch.set(scenarioRef, {
            title,
            slug,
            description,
            difficulty,
            sourceLabel: sourceLabel || fileName,
            isPublished: false,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
          validQuestions.forEach((q, i) => {
            batch.set(doc(questionsCol, String(i)), {
              seq: i,
              text: q.text.trim(),
              hint: q.hint.trim() || null,
              isPublished: false,
            });
            batch.set(doc(questionAnswersCol, String(i)), {
              answer: q.answer.trim(),
            });
          });
        }
        for (const r of chunk) {
          const logRef = doc(logsCol, String(r.seq));
          batch.set(logRef, {
            seq: r.seq,
            eventTime: r.event_time,
            eventId: r.event_id,
            source: r.source,
            message: r.message,
            raw: r.raw ?? null,
            isPublished: false,
          });
          batch.set(doc(answersCol, String(r.seq)), {
            isMalicious: r.is_malicious,
            mitre: r.mitre || null,
            explanation: r.explanation,
          });
        }
        await batch.commit();
      }

      // Phase 2: flip isPublished to true on the scenario and every log /
      // question doc. Security rules read this flag directly off each doc
      // (see firestore.rules), so trainees never trigger an extra get()
      // per document the way a get()-on-parent rule would.
      const flipChunks: string[][] = [];
      for (let i = 0; i < rows.length; i += 450) {
        flipChunks.push(rows.slice(i, i + 450).map((r) => String(r.seq)));
      }
      for (const [i, ids] of flipChunks.entries()) {
        const batch = writeBatch(db);
        if (i === 0) {
          batch.update(scenarioRef, { isPublished: true });
          validQuestions.forEach((_, qi) => {
            batch.update(doc(questionsCol, String(qi)), { isPublished: true });
          });
        }
        for (const id of ids) {
          batch.update(doc(logsCol, id), { isPublished: true });
        }
        await batch.commit();
      }

      toast.success("Scenario created and published");
      setTitle("");
      setSlug("");
      setDescription("");
      setSourceLabel("");
      setRows([]);
      setFileName("");
      setQuestions([newQuestionDraft()]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["admin-scenarios"] });
      qc.invalidateQueries({ queryKey: ["published-scenarios"] });
      qc.invalidateQueries({ queryKey: ["published-scenario-count"] });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to publish scenario",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="panel p-6 max-w-md text-center space-y-2">
          <ShieldX className="h-6 w-6 text-destructive mx-auto" />
          <p className="text-sm text-foreground">Admin access required.</p>
          <p className="text-xs text-muted-foreground">
            Only {ADMIN_EMAIL} can access the Scenario Builder.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Toaster theme="dark" position="top-right" />
      <PageHeader
        eyebrow="Module · ADM-001"
        title="Scenario Builder"
        subtitle="Ingest a real log export and define the answer key trainees will be graded against."
      />

      <div className="px-4 lg:px-8 py-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          title="1 · Scenario Details"
          code="META"
          className="xl:col-span-1"
        >
          <div className="space-y-4">
            <Field
              label="Title"
              value={title}
              onChange={setTitle}
              placeholder="Emotet Lateral Movement"
            />
            <Field
              label="Slug (unique, url-safe)"
              value={slug}
              onChange={setSlug}
              placeholder="emotet-lateral-movement"
            />
            <Field
              label="Source label"
              value={sourceLabel}
              onChange={setSourceLabel}
              placeholder="e.g. Sysmon export, PC-DEFENDER-01"
            />
            <div>
              <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                Difficulty
              </div>
              <div className="flex gap-2">
                {(["easy", "medium", "hard"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 rounded-sm border px-3 py-1.5 text-xs font-mono uppercase tracking-widest transition ${
                      difficulty === d
                        ? "border-cyber/50 bg-cyber/10 text-cyber"
                        : "border-border bg-surface-2 text-muted-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                Description
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-cyber focus:ring-1 focus:ring-cyber transition"
                placeholder="Briefing the trainee sees before starting…"
              />
            </label>
          </div>
        </Panel>

        <Panel
          title="2 · Ingest Real Log File"
          code="UPLOAD"
          className="xl:col-span-2"
        >
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-sm py-8 cursor-pointer hover:border-cyber/50 transition">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-mono text-muted-foreground">
                {fileName ||
                  "Drop a .csv, .json, or Windows Event Viewer .xml export"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.xml,.log,.txt"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && onFile(e.target.files[0])
                }
              />
            </label>

            {rows.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>{rows.length} lines parsed</span>
                  <span className="text-cyber">
                    {maliciousCount} marked malicious
                  </span>
                </div>
                <div className="overflow-auto max-h-[480px] -mx-4">
                  <table className="w-full text-xs font-mono">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                        <th className="text-left font-normal py-2 px-3">#</th>
                        <th className="text-left font-normal py-2 px-3">
                          Time
                        </th>
                        <th className="text-left font-normal py-2 px-3">
                          Event
                        </th>
                        <th className="text-left font-normal py-2 px-3">
                          Message
                        </th>
                        <th className="text-left font-normal py-2 px-3">
                          MITRE
                        </th>
                        <th className="text-left font-normal py-2 px-3">
                          Malicious?
                        </th>
                        <th className="text-left font-normal py-2 px-3">
                          Explanation
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {rows.map((r, i) => (
                        <tr
                          key={r.seq}
                          className={r.is_malicious ? "bg-destructive/5" : ""}
                        >
                          <td className="py-1.5 px-3 text-muted-foreground">
                            {r.seq}
                          </td>
                          <td className="py-1.5 px-3 text-muted-foreground whitespace-nowrap">
                            {r.event_time ?? "—"}
                          </td>
                          <td className="py-1.5 px-3">{r.event_id ?? "—"}</td>
                          <td
                            className="py-1.5 px-3 max-w-xs truncate"
                            title={r.message}
                          >
                            {r.message}
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              value={r.mitre}
                              onChange={(e) =>
                                updateRow(setRows, i, { mitre: e.target.value })
                              }
                              placeholder="T1059.001"
                              className="w-24 bg-input border border-border rounded-sm px-1.5 py-1 text-[11px] focus:outline-none focus:border-cyber"
                            />
                          </td>
                          <td className="py-1.5 px-3">
                            <button
                              onClick={() =>
                                updateRow(setRows, i, {
                                  is_malicious: !r.is_malicious,
                                })
                              }
                              className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] uppercase tracking-widest border ${
                                r.is_malicious
                                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                                  : "border-border bg-surface-2 text-muted-foreground"
                              }`}
                            >
                              {r.is_malicious ? (
                                <ShieldX className="h-3 w-3" />
                              ) : (
                                <ShieldCheck className="h-3 w-3" />
                              )}
                              {r.is_malicious ? "Malicious" : "Benign"}
                            </button>
                          </td>
                          <td className="py-1.5 px-3">
                            <input
                              value={r.explanation}
                              onChange={(e) =>
                                updateRow(setRows, i, {
                                  explanation: e.target.value,
                                })
                              }
                              placeholder="Why this is/isn't malicious…"
                              className="w-48 bg-input border border-border rounded-sm px-1.5 py-1 text-[11px] focus:outline-none focus:border-cyber"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <button
              onClick={publish}
              disabled={saving || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish scenario
            </button>
          </div>
        </Panel>
      </div>

      <div className="px-4 lg:px-8 pb-12">
        <Panel title="Existing Scenarios" code="LIST">
          {loadingScenarios ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono border-b border-border">
                  <th className="text-left font-normal py-2 px-3">Title</th>
                  <th className="text-left font-normal py-2 px-3">Slug</th>
                  <th className="text-left font-normal py-2 px-3">
                    Difficulty
                  </th>
                  <th className="text-left font-normal py-2 px-3">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(scenarios ?? []).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 px-3">{s.title}</td>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                      {s.slug}
                    </td>
                    <td className="py-2 px-3 text-xs uppercase text-muted-foreground">
                      {s.difficulty}
                    </td>
                    <td className="py-2 px-3 text-xs">
                      {s.isPublished ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function updateRow(
  setRows: React.Dispatch<React.SetStateAction<DraftRow[]>>,
  index: number,
  patch: Partial<DraftRow>,
) {
  setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
        {label}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-cyber focus:ring-1 focus:ring-cyber transition"
      />
    </label>
  );
}
