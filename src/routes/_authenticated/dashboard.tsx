import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { ArrowUpRight, Cpu, Loader2, Target, TrendingUp } from "lucide-react";
import { db } from "@/integrations/firebase/client";
import type { Attempt, Profile } from "@/integrations/firebase/types";
import { toMillis } from "@/integrations/firebase/types";
import type { User } from "firebase/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Analyst Dashboard · ti3lab" },
      { name: "description", content: "Your real training progress and available scenarios." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext() as { user: User };

  const { data: profile } = useQuery({
    queryKey: ["profile", user.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "profiles", user.uid));
      return snap.exists() ? (snap.data() as Profile) : null;
    },
  });

  const { data: rankData } = useQuery({
    queryKey: ["rank", user.uid, profile?.xp ?? 0],
    queryFn: async () => {
      const totalSnap = await getCountFromServer(collection(db, "profiles"));
      const aboveSnap = await getCountFromServer(
        query(collection(db, "profiles"), where("xp", ">", profile?.xp ?? 0)),
      );
      return { total: totalSnap.data().count, rank: aboveSnap.data().count + 1 };
    },
    enabled: !!profile,
  });

  const { data: scenarioCount } = useQuery({
    queryKey: ["published-scenario-count"],
    queryFn: async () => {
      const snap = await getCountFromServer(
        query(collection(db, "scenarios"), where("isPublished", "==", true)),
      );
      return snap.data().count;
    },
  });

  const { data: recentAttempts, isLoading: loadingAttempts } = useQuery({
    queryKey: ["recent-attempts", user.uid],
    queryFn: async () => {
      const snap = await getDocs(
        query(
          collection(db, "attempts"),
          where("userId", "==", user.uid),
          orderBy("submittedAt", "desc"),
          limit(8),
        ),
      );
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Attempt) }));
    },
  });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
      <PageHeader
        eyebrow="Module · DSH-001"
        title="Operator Dashboard"
        subtitle="Your real training progress — every number here comes from your actual attempts."
      />

      <div className="px-4 lg:px-8 pb-12 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi
            icon={Target}
            label="Total XP"
            value={(profile?.xp ?? 0).toLocaleString()}
            hint={profile?.badge ?? "Recruit"}
            accent
          />
          <Kpi
            icon={TrendingUp}
            label="Global rank"
            value={rankData ? `#${rankData.rank}` : "—"}
            hint={rankData ? `of ${rankData.total} analysts` : "syncing"}
          />
          <Kpi
            icon={Cpu}
            label="Cases closed"
            value={String(profile?.casesClosed ?? 0)}
            hint="score ≥ 70%"
          />
          <Kpi
            icon={ArrowUpRight}
            label="Scenarios available"
            value={String(scenarioCount ?? 0)}
            hint="published by admin"
          />
        </div>

        <Panel
          title="Your Recent Attempts"
          code={loadingAttempts ? "…" : `${recentAttempts?.length ?? 0}`}
        >
          {loadingAttempts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : recentAttempts && recentAttempts.length > 0 ? (
            <div className="overflow-x-auto -m-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono border-b border-border">
                    <th className="text-left font-normal py-2 px-4">Scenario</th>
                    <th className="text-left font-normal py-2 px-4">Score</th>
                    <th className="text-left font-normal py-2 px-4">Correct</th>
                    <th className="text-left font-normal py-2 px-4">XP</th>
                    <th className="text-left font-normal py-2 px-4">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {recentAttempts.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-2 transition-colors">
                      <td className="py-2.5 px-4 text-foreground">{a.scenarioTitle}</td>
                      <td
                        className={`py-2.5 px-4 font-display ${a.score >= 70 ? "text-success" : "text-destructive"}`}
                      >
                        {a.score}%
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">
                        {a.correctCount}/{a.totalCount}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-cyber">+{a.xpAwarded}</td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {new Date(toMillis(a.submittedAt)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No attempts yet. Head to the Log Workbench and solve a scenario to see real results
              here.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-surface/30 px-4 lg:px-8 py-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyber">
          {eyebrow}
        </div>
        <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-foreground">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className={`panel p-4 ${accent ? "ring-cyber" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <Icon
          className={`h-4 w-4 ${accent ? "text-cyber" : "text-muted-foreground"}`}
          strokeWidth={1.5}
        />
      </div>
      <div
        className={`mt-3 font-display text-2xl lg:text-3xl ${accent ? "text-cyber" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] font-mono text-muted-foreground">{hint}</div>
    </div>
  );
}

export function Panel({
  title,
  code,
  children,
  className = "",
  right,
}: {
  title: string;
  code?: string;
  children: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className={`panel ${className}`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-sm font-semibold text-foreground">{title}</h2>
          {code && <span className="chip">{code}</span>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
