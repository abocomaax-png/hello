import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid,
  Terminal,
  ShieldAlert,
  Trophy,
  Settings,
  LogOut,
  Radar,
  Wrench,
} from "lucide-react";
import { signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { Brand } from "./Brand";
import type { User } from "firebase/auth";

const ADMIN_EMAIL = "abocomaax@gmail.com";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid, code: "DSH" },
  { to: "/workbench", label: "Log Workbench", icon: Terminal, code: "DFR" },
  { to: "/incidents", label: "Incident Lab", icon: ShieldAlert, code: "IR" },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy, code: "LDR" },
  { to: "/settings", label: "Settings", icon: Settings, code: "CFG" },
] as const;

const adminNav = {
  to: "/admin/scenarios",
  label: "Scenario Builder",
  icon: Wrench,
  code: "ADM",
} as const;

export function AppSidebar({ user }: { user: User | null }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isAdmin = (user?.email ?? "").toLowerCase() === ADMIN_EMAIL;
  const items = isAdmin ? [...nav, adminNav] : nav;

  const signOut = async () => {
    await firebaseSignOut(auth);
    router.navigate({ to: "/auth" });
  };

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-border bg-surface/50 backdrop-blur">
      <div className="h-14 flex items-center px-5 border-b border-border">
        <Brand />
      </div>

      <div className="px-5 py-4 border-b border-border">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
          Operator
        </div>
        <div className="mt-1 text-sm text-foreground truncate">
          {user?.email ?? "analyst@ti3lab"}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyber opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber" />
          </span>
          <span className="text-[11px] font-mono text-cyber uppercase tracking-widest">
            On-shift · secure
          </span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
          Modules
        </div>
        {items.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent text-cyber ring-cyber"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              <span className="flex-1">{item.label}</span>
              <span
                className={`font-mono text-[10px] tracking-widest ${active ? "text-cyber" : "text-muted-foreground/60"}`}
              >
                {item.code}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 space-y-3">
        <div className="panel-2 p-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
            <Radar className="h-3 w-3 text-cyber" /> Threat level
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-cyber font-display text-lg">ELEVATED</span>
            <span className="chip chip-cyber">4 / 5</span>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function MobileTopBar({ user }: { user: User | null }) {
  const router = useRouter();
  const signOut = async () => {
    await firebaseSignOut(auth);
    router.navigate({ to: "/auth" });
  };
  return (
    <div className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4">
      <Brand />
      <div className="flex items-center gap-3">
        <span className="chip chip-cyber">{user?.email?.split("@")[0] ?? "analyst"}</span>
        <button onClick={signOut} className="text-muted-foreground hover:text-destructive">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
