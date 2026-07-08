import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Terminal, Activity, ArrowUpRight, LineChart, Trophy } from "lucide-react";
import { Brand, BrandMark } from "@/components/Brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ti3lab — Cyber Defense Operations Platform" },
      {
        name: "description",
        content:
          "Train blue-team defenders on real SOC playbooks, DFIR log analytics and live incident response — inside a single engineered platform.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="relative z-20 border-b border-border/60">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Brand />
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#modules" className="hover:text-foreground transition">
              Modules
            </a>
            <a href="#workbench" className="hover:text-foreground transition">
              Workbench
            </a>
            <a href="#incident" className="hover:text-foreground transition">
              Incident Lab
            </a>
            <a href="#leaderboard" className="hover:text-foreground transition">
              Leaderboard
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/auth"
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              Access defense portal
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0 bg-scanlines" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/60 to-background" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-cyber/10 blur-[140px]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-24 pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="chip chip-cyber">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyber animate-pulse" />
                Blue Team · DFIR · SOC
              </span>
              <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold tracking-tight leading-[0.95]">
                Defend production
                <br />
                like the <span className="text-cyber text-cyber-glow">adversary</span>
                <br />
                is already inside.
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
                ti3lab is a high-fidelity training environment for security operations analysts,
                digital forensics investigators and incident responders. Real playbooks, real logs,
                real time-pressure.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/auth"
                  search={{ mode: "signup" } as never}
                  className="group inline-flex items-center gap-2 rounded-sm bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
                >
                  Begin defense simulation
                  <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-5 py-3 text-sm font-medium text-foreground hover:bg-accent transition"
                >
                  Sign in to console
                </Link>
              </div>

              <dl className="mt-14 grid grid-cols-3 gap-6 max-w-lg">
                {[
                  { k: "Live cases", v: "128" },
                  { k: "MITRE techniques", v: "217" },
                  { k: "EVTX samples", v: "4.3k" },
                ].map((s) => (
                  <div key={s.k} className="border-l border-cyber/40 pl-4">
                    <dt className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                      {s.k}
                    </dt>
                    <dd className="mt-1 font-display text-2xl text-foreground">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Terminal panel */}
            <div className="lg:col-span-5">
              <div className="panel overflow-hidden ring-cyber">
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5 bg-surface-2">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-destructive/60" />
                    <span className="inline-block h-2 w-2 rounded-full bg-warning/60" />
                    <span className="inline-block h-2 w-2 rounded-full bg-cyber/60" />
                    <span className="ml-3">ti3lab://console/soc-01</span>
                  </div>
                  <span className="chip chip-cyber">LIVE</span>
                </div>
                <pre className="font-mono text-[12px] leading-relaxed text-muted-foreground p-5 whitespace-pre-wrap">
                  {`> ti3lab connect --workspace soc-alpha
[ok] tunnel established · latency 14ms
[ok] EDR telemetry: 12 endpoints streaming

> ti3lab case open 9982
`}
                  <span className="text-cyber">[case] #9982 · Emotet Lateral Movement</span>
                  {`
       severity : `}
                  <span className="text-destructive">CRITICAL</span>
                  {`
       techniques: T1021.002, T1059.001, T1112
       assigned : you

> analyze evtx --tag mitre:T1059
[hit] 4104 · ScriptBlock IEX (New-Object Net.WebClient)…
[hit] 4688 · powershell.exe -EncodedCommand JAB…
[hit] 1102 · audit log cleared on PC-DEFENDER-01

`}
                  <span className="text-warning">[!] anomalous outbound: 185.244.25.187:443</span>
                  {`

> playbook run --step 3
`}
                  <span className="text-cyber">[✓] endpoint isolated via EDR containment</span>
                  {`
`}
                  <span className="text-cyber">[✓] +120 XP awarded</span>
                  {`
`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="relative py-24 border-t border-border/60">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="chip">Architecture</span>
              <h2 className="mt-4 font-display text-4xl md:text-5xl font-bold">
                Six modules. One <span className="text-cyber">operational plane</span>.
              </h2>
            </div>
            <p className="hidden md:block max-w-sm text-sm text-muted-foreground">
              Everything an analyst does during a shift — triage, hunt, contain, report — happens
              without leaving the console.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Activity,
                code: "DSH",
                title: "Analyst Dashboard",
                body: "Threat landscape, daily alert cadence, XP progression and open case queue on one command surface.",
              },
              {
                icon: Terminal,
                code: "DFR",
                title: "DFIR Log Workbench",
                body: "Interactive EVTX-ATTACK-SAMPLES parser. Windows Event IDs mapped to MITRE ATT&CK techniques, anomalies highlighted in cyber-blue.",
              },
              {
                icon: ShieldCheck,
                code: "IR",
                title: "Live Incident Lab",
                body: "Handle real tickets end-to-end. Isolate hosts, launch scans, pivot to IOCs — every action recorded on the threat timeline.",
              },
              {
                icon: LineChart,
                code: "PLY",
                title: "SOC Playbooks",
                body: "Deterministic containment and eradication runbooks scoped to the active case. Check off steps, generate the executive brief.",
              },
              {
                icon: Trophy,
                code: "LDR",
                title: "Global Leaderboard",
                body: "Gamified progression. Earn XP for correct triage decisions, promotion badges for closed criticals, worldwide ranking.",
              },
              {
                icon: BrandLogoIcon,
                code: "AUTH",
                title: "Secure Access",
                body: "Email + password authentication backed by Firebase Auth and locked-down Firestore security rules on every collection.",
              },
            ].map((m) => {
              const Icon = m.icon as typeof Activity;
              return (
                <div
                  key={m.title}
                  className="panel p-6 hover:border-cyber/40 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-cyber" strokeWidth={1.5} />
                    <span className="chip">{m.code}</span>
                  </div>
                  <h3 className="mt-6 font-display text-xl">{m.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 border-t border-border/60">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="chip chip-cyber">Access defense portal</span>
          <h2 className="mt-6 font-display text-4xl md:text-5xl font-bold">
            Your next shift starts <span className="text-cyber">now</span>.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Provision your analyst credentials, drop into the console, and take your first case
            within 60 seconds.
          </p>
          <div className="mt-8">
            <Link
              to="/auth"
              search={{ mode: "signup" } as never}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
            >
              Create operator account
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <BrandMark size={16} />
            <span>ti3lab · defensive cybersecurity operations · training environment</span>
          </div>
          <span>v1.0.0 · build stable</span>
        </div>
      </footer>
    </div>
  );
}

function BrandLogoIcon(props: React.SVGProps<SVGSVGElement>) {
  return <BrandMark size={20} {...(props as { size?: number })} />;
}
