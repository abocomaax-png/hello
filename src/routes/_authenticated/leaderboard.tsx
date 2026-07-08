import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { Trophy, Medal, Award } from "lucide-react";
import { db } from "@/integrations/firebase/client";
import type { Profile } from "@/integrations/firebase/types";
import type { User } from "firebase/auth";
import { PageHeader, Panel } from "./dashboard";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard · ti3lab" },
      { name: "description", content: "Global analyst rankings." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const { user } = Route.useRouteContext() as { user: User };

  const { data: rows = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "profiles"), orderBy("xp", "desc"), limit(50)),
      );
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Profile) }));
    },
  });

  const combined = rows.map((r, i) => ({
    rank: i + 1,
    handle: r.handle,
    xp: r.xp,
    badge: r.badge,
    casesClosed: r.casesClosed,
    isMe: r.id === user.uid,
  }));

  const top3 = combined.slice(0, 3);

  return (
    <div>
      <PageHeader
        eyebrow="Module · LDR-004"
        title="Platform Leaderboard"
        subtitle="Global analyst rankings · XP earned from real graded scenario attempts"
      />

      <div className="px-4 lg:px-8 py-6 space-y-6">
        {combined.length === 0 ? (
          <Panel title="Global Rankings" code="EMPTY">
            <p className="text-sm text-muted-foreground py-8 text-center">
              No analysts have earned XP yet. Solve a scenario in the Log Workbench to be first on
              the board.
            </p>
          </Panel>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3.map((r, i) => (
                <PodiumCard key={r.handle + i} entry={r} position={i + 1} />
              ))}
            </div>

            <Panel title="Global Rankings" code={`TOP ${combined.length}`}>
              <div className="overflow-x-auto -m-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono border-b border-border">
                      <th className="text-left font-normal py-2 px-4 w-16">Rank</th>
                      <th className="text-left font-normal py-2 px-4">Analyst</th>
                      <th className="text-right font-normal py-2 px-4">Total XP</th>
                      <th className="text-right font-normal py-2 px-4 hidden md:table-cell">
                        Cases
                      </th>
                      <th className="text-left font-normal py-2 px-4">Badge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {combined.map((r) => (
                      <tr
                        key={r.handle + r.rank}
                        className={`transition-colors ${r.isMe ? "bg-cyber/10" : "hover:bg-surface-2"}`}
                      >
                        <td className="py-3 px-4 font-mono">
                          <span
                            className={`inline-block w-8 text-right ${r.rank <= 3 ? "text-cyber" : "text-muted-foreground"}`}
                          >
                            {String(r.rank).padStart(2, "0")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-sm bg-surface-2 border border-border flex items-center justify-center font-mono text-[11px] text-cyber">
                              {r.handle.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-foreground text-sm">{r.handle}</div>
                              {r.isMe && (
                                <div className="text-[10px] font-mono uppercase tracking-widest text-cyber">
                                  you
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-display text-cyber">
                          {r.xp.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-muted-foreground hidden md:table-cell font-mono text-xs">
                          {r.casesClosed}
                        </td>
                        <td className="py-3 px-4">
                          <span className="chip">{r.badge}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  );
}

function PodiumCard({
  entry,
  position,
}: {
  entry: { handle: string; xp: number; badge: string; casesClosed: number; isMe?: boolean };
  position: number;
}) {
  const Icon = position === 1 ? Trophy : position === 2 ? Medal : Award;
  return (
    <div className={`panel p-6 relative overflow-hidden ${position === 1 ? "ring-cyber" : ""}`}>
      {position === 1 && (
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-cyber/10 blur-3xl" />
      )}
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Position #{position}
          </div>
          <div className="mt-1 font-display text-xl text-foreground">{entry.handle}</div>
          {entry.isMe && <span className="chip chip-cyber mt-2">You</span>}
        </div>
        <Icon
          className={`h-8 w-8 ${position === 1 ? "text-cyber" : "text-muted-foreground"}`}
          strokeWidth={1.25}
        />
      </div>
      <div className="relative mt-6 flex items-baseline justify-between">
        <div>
          <div className="font-display text-3xl text-cyber">{entry.xp.toLocaleString()}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
            Total XP
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl text-foreground">{entry.casesClosed}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
            Cases
          </div>
        </div>
      </div>
      <div className="relative mt-4 pt-4 border-t border-border">
        <span className="chip">{entry.badge}</span>
      </div>
    </div>
  );
}
