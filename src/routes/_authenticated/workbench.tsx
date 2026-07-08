import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { toast } from "sonner";
import {
  ChevronDown,
  Loader2,
  Lightbulb,
  Search,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { db, auth } from "@/integrations/firebase/client";
import { submitScenarioAttempt } from "@/server/submit-scenario-attempt";
import type {
  Scenario,
  ScenarioLog,
  ScenarioQuestion,
  SubmitScenarioAttemptResponse,
} from "@/integrations/firebase/types";
import type { User } from "firebase/auth";
import { PageHeader, Panel } from "./dashboard";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/workbench")({
  head: () => ({
    meta: [
      { title: "DFIR Log Workbench · ti3lab" },
      {
        name: "description",
        content: "Triage real, uploaded log data and get graded.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Workbench,
});

function Workbench() {
  const { user } = Route.useRouteContext() as { user: User };
  const qc = useQueryClient();

  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [query_, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, string>
  >({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>(
    {},
  );
  const [grade, setGrade] = useState<SubmitScenarioAttemptResponse | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);

  const { data: scenarios, isLoading: loadingScenarios } = useQuery({
    queryKey: ["published-scenarios"],
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(db, "scenarios"),
          where("isPublished", "==", true),
          orderBy("createdAt", "desc"),
        ),
      );
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Scenario) }));
    },
  });

  const activeScenario = useMemo(
    () => scenarios?.find((s) => s.id === scenarioId) ?? scenarios?.[0] ?? null,
    [scenarios, scenarioId],
  );

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["scenario-logs", activeScenario?.id],
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(db, "scenarios", activeScenario!.id, "logs"),
          orderBy("seq", "asc"),
        ),
      );
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ScenarioLog) }));
    },
    enabled: !!activeScenario,
  });

  const { data: questions } = useQuery({
    queryKey: ["scenario-questions", activeScenario?.id],
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(db, "scenarios", activeScenario!.id, "questions"),
          orderBy("seq", "asc"),
        ),
      );
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as ScenarioQuestion),
      }));
    },
    enabled: !!activeScenario,
  });

  const rows = useMemo(() => {
    return (logs ?? []).filter((r) => {
      if (showFlaggedOnly && !flagged[r.id]) return false;
      if (!query_) return true;
      const q = query_.toLowerCase();
      return (
        (r.eventId ?? "").toLowerCase().includes(q) ||
        (r.source ?? "").toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [logs, query_, showFlaggedOnly, flagged]);

  const row = rows[selected] ?? rows[0];
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  const selectScenario = (id: string) => {
    setScenarioId(id);
    setFlagged({});
    setQuestionAnswers({});
    setRevealedHints({});
    setGrade(null);
    setSelected(0);
    setQuery("");
  };

  const submit = async () => {
    if (!activeScenario) return;
    if (!auth.currentUser) {
      toast.error("You must be signed in to submit");
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const answers = (logs ?? []).map((l) => ({
        logId: l.id,
        markedMalicious: !!flagged[l.id],
      }));
      const qAnswers = (questions ?? []).map((q) => ({
        questionId: q.id,
        answerText: questionAnswers[q.id] ?? "",
      }));
      const res = await submitScenarioAttempt({
        data: {
          idToken,
          scenarioId: activeScenario.id,
          answers,
          questionAnswers: qAnswers,
        },
      });
      setGrade(res);
      toast.success(`Scored ${res.score}% · +${res.xpAwarded} XP`);
      qc.invalidateQueries({ queryKey: ["profile", user.uid] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["rank", user.uid] });
      qc.invalidateQueries({ queryKey: ["recent-attempts", user.uid] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Grading failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Toaster theme="dark" position="top-right" />
      <PageHeader
        eyebrow="Module · DFR-002"
        title="DFIR Log Workbench"
        subtitle="Triage real, uploaded log data. Flag what you believe is malicious, then submit for grading."
      />

      <div className="px-4 lg:px-8 py-6 space-y-4">
        <div className="panel flex flex-wrap items-center gap-3 p-3">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-sm bg-input flex-1 min-w-64">
            {loadingScenarios ? (
              <span className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
                scenarios…
              </span>
            ) : scenarios && scenarios.length > 0 ? (
              <select
                value={activeScenario?.id ?? ""}
                onChange={(e) => selectScenario(e.target.value)}
                className="bg-transparent text-sm font-mono outline-none flex-1 text-cyber"
              >
                {scenarios.map((s) => (
                  <option
                    key={s.id}
                    value={s.id}
                    className="bg-surface text-foreground"
                  >
                    {s.title} · {s.difficulty}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted-foreground">
                No published scenarios yet — ask an admin to publish one from
                Scenario Builder.
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-sm bg-input flex-1 min-w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={query_}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by Event ID, source, message…"
              className="bg-transparent text-sm font-mono outline-none flex-1 placeholder:text-muted-foreground/60"
            />
          </div>
          <button
            onClick={() => setShowFlaggedOnly((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[11px] font-mono uppercase tracking-widest transition ${
              showFlaggedOnly
                ? "border-cyber/50 bg-cyber/10 text-cyber"
                : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> Flagged ({flaggedCount})
          </button>
        </div>

        {activeScenario?.description && (
          <Panel title="Briefing" code="BRIEF">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {activeScenario.description}
            </p>
            {activeScenario.sourceLabel && (
              <p className="mt-2 text-[11px] font-mono text-muted-foreground/70">
                Source: {activeScenario.sourceLabel}
              </p>
            )}
          </Panel>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel
            title="Event Stream"
            code={loadingLogs ? "…" : `${rows.length} events`}
            className="xl:col-span-2"
          >
            <div className="overflow-x-auto -m-4">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                    <th className="text-left font-normal py-2 px-3">
                      Timestamp
                    </th>
                    <th className="text-left font-normal py-2 px-3">
                      Event ID
                    </th>
                    <th className="text-left font-normal py-2 px-3">Source</th>
                    <th className="text-left font-normal py-2 px-3">Flag</th>
                    {grade && (
                      <th className="text-left font-normal py-2 px-3">
                        Result
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((r, i) => {
                    const active = i === selected;
                    const isFlagged = !!flagged[r.id];
                    const outcome = grade?.results.find(
                      (res) => res.logId === r.id,
                    );
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(i)}
                        className={`cursor-pointer transition-colors ${active ? "bg-cyber/10 text-cyber" : "hover:bg-surface-2"}`}
                      >
                        <td className="py-2 px-3">{r.eventTime ?? "—"}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 ${isFlagged ? "text-cyber" : "text-foreground"}`}
                          >
                            {isFlagged && (
                              <span className="h-1.5 w-1.5 rounded-full bg-cyber animate-pulse" />
                            )}
                            {r.eventId ?? "—"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.source ?? "—"}
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (grade) return;
                              setFlagged((f) => ({ ...f, [r.id]: !f[r.id] }));
                            }}
                            disabled={!!grade}
                            className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] uppercase tracking-widest border disabled:opacity-70 ${
                              isFlagged
                                ? "border-cyber/50 bg-cyber/10 text-cyber"
                                : "border-border bg-surface-2 text-muted-foreground"
                            }`}
                          >
                            {isFlagged ? (
                              <ShieldAlert className="h-3 w-3" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            {isFlagged ? "Suspicious" : "Benign"}
                          </button>
                        </td>
                        {grade && (
                          <td className="py-2 px-3">
                            <span
                              className={
                                outcome?.correct
                                  ? "text-success"
                                  : "text-destructive"
                              }
                            >
                              {outcome?.correct ? "Correct" : "Incorrect"}
                              {outcome?.isMalicious
                                ? " · malicious"
                                : " · benign"}
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Detailed Event Data" code={row?.eventId ?? undefined}>
            {row ? (
              <div className="space-y-4 text-sm">
                <DetailRow
                  label="Timestamp"
                  value={row.eventTime ?? "—"}
                  mono
                />
                <DetailRow
                  label="Event ID"
                  value={row.eventId ?? "—"}
                  mono
                  accent
                />
                <DetailRow label="Source" value={row.source ?? "—"} mono />
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                    Message
                  </div>
                  <pre className="panel-2 p-3 text-xs font-mono whitespace-pre-wrap text-foreground/90 leading-relaxed">
                    {row.message}
                  </pre>
                </div>
                {grade &&
                  (() => {
                    const outcome = grade.results.find(
                      (res) => res.logId === row.id,
                    );
                    if (!outcome) return null;
                    return (
                      <div className="panel-2 p-3 space-y-1 text-xs">
                        <div
                          className={
                            outcome.correct
                              ? "text-success"
                              : "text-destructive"
                          }
                        >
                          Your call was{" "}
                          {outcome.correct ? "correct" : "incorrect"}
                        </div>
                        {outcome.mitre && (
                          <div className="text-muted-foreground">
                            MITRE: {outcome.mitre}
                          </div>
                        )}
                        {outcome.explanation && (
                          <div className="text-muted-foreground">
                            {outcome.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                {loadingLogs ? "Loading events…" : "No events to display."}
              </div>
            )}
          </Panel>
        </div>

        {activeScenario && questions && questions.length > 0 && !grade && (
          <Panel title="Debrief Questions">
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-foreground">
                      <span className="text-muted-foreground font-mono mr-2">
                        Q{i + 1}.
                      </span>
                      {q.text}
                    </div>
                    {q.hint && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedHints((r) => ({ ...r, [q.id]: !r[q.id] }))
                        }
                        className="shrink-0 inline-flex items-center gap-1 rounded-sm border border-border bg-surface-2 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
                      >
                        <Lightbulb className="h-3 w-3" />
                        {revealedHints[q.id] ? "Hide hint" : "Show hint"}
                      </button>
                    )}
                  </div>
                  {q.hint && revealedHints[q.id] && (
                    <div className="rounded-sm border border-cyber/30 bg-cyber/5 px-3 py-2 text-xs text-cyber">
                      {q.hint}
                    </div>
                  )}
                  <input
                    type="text"
                    value={questionAnswers[q.id] ?? ""}
                    onChange={(e) =>
                      setQuestionAnswers((a) => ({
                        ...a,
                        [q.id]: e.target.value,
                      }))
                    }
                    placeholder="Your answer…"
                    className="w-full rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyber"
                  />
                </div>
              ))}
            </div>
          </Panel>
        )}

        {activeScenario && !grade && (
          <div className="panel p-4 flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-mono">
              {flaggedCount} of {rows.length} events flagged as suspicious
            </div>
            <button
              onClick={submit}
              disabled={submitting || !logs || logs.length === 0}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit for grading
            </button>
          </div>
        )}

        {grade && (
          <div className="panel p-4 flex flex-wrap items-center gap-6">
            <Stat label="Score" value={`${grade.score}%`} accent />
            <Stat
              label="Correct"
              value={`${grade.correctCount}/${grade.totalCount}`}
            />
            <Stat label="XP awarded" value={`+${grade.xpAwarded}`} />
            <button
              onClick={() => {
                setGrade(null);
                setFlagged({});
                setQuestionAnswers({});
                setRevealedHints({});
              }}
              className="ml-auto inline-flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-4 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
            >
              Retry scenario
            </button>
          </div>
        )}

        {grade && grade.questionResults.length > 0 && (
          <Panel title="Debrief Questions — Results">
            <div className="space-y-3">
              {grade.questionResults.map((qr, i) => (
                <div
                  key={qr.questionId}
                  className={`rounded-sm border px-3 py-2 text-sm ${
                    qr.correct
                      ? "border-cyber/30 bg-cyber/5"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                    {qr.correct ? (
                      <ShieldCheck className="h-3.5 w-3.5 text-cyber" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                    )}
                    Q{i + 1}
                  </div>
                  <div className="text-foreground mb-1">{qr.question}</div>
                  <div className="text-xs text-muted-foreground">
                    Your answer:{" "}
                    <span className="text-foreground">
                      {qr.submittedAnswer || "—"}
                    </span>
                  </div>
                  {!qr.correct && (
                    <div className="text-xs text-muted-foreground">
                      Correct answer:{" "}
                      <span className="text-foreground">
                        {qr.correctAnswer}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`${mono ? "font-mono" : ""} text-xs ${accent ? "text-cyber" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-display text-xl ${accent ? "text-cyber" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
