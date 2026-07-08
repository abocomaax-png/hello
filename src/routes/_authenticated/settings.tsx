import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile as updateAuthProfile } from "firebase/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { db } from "@/integrations/firebase/client";
import type { Profile } from "@/integrations/firebase/types";
import { toMillis } from "@/integrations/firebase/types";
import type { User } from "firebase/auth";
import { PageHeader, Panel } from "./dashboard";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Settings · ti3lab" }, { name: "robots", content: "noindex" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext() as { user: User };
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "profiles", user.uid));
      return snap.exists() ? (snap.data() as Profile) : null;
    },
  });

  const [displayName, setDisplayName] = useState<string>("");
  const [handle, setHandle] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const current = { displayName: profile?.displayName ?? "", handle: profile?.handle ?? "" };
  const dn = displayName || current.displayName;
  const hn = handle || current.handle;

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "profiles", user.uid), { displayName: dn, handle: hn });
      if (user.displayName !== hn) await updateAuthProfile(user, { displayName: hn });
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile", user.uid] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Toaster theme="dark" position="top-right" />
      <PageHeader
        eyebrow="Module · CFG-005"
        title="Operator Settings"
        subtitle="Callsign, display identity and workspace preferences"
      />

      <div className="px-4 lg:px-8 py-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel title="Identity" code="IDENT" className="xl:col-span-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Syncing profile…
            </div>
          ) : (
            <div className="space-y-5">
              <SettingField label="Email" value={user.email ?? ""} readOnly />
              <SettingField
                label="Callsign (handle)"
                value={hn}
                onChange={setHandle}
                hint="Public identifier on the leaderboard"
              />
              <SettingField label="Display name" value={dn} onChange={setDisplayName} />
              <div className="pt-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Commit changes
                </button>
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Operator Stats" code="STATS">
          <div className="space-y-4">
            <Stat label="Total XP" value={(profile?.xp ?? 0).toLocaleString()} accent />
            <Stat label="Badge" value={profile?.badge ?? "Recruit"} />
            <Stat label="Cases closed" value={String(profile?.casesClosed ?? 0)} />
            <Stat
              label="Member since"
              value={
                profile?.createdAt
                  ? new Date(toMillis(profile.createdAt)).toLocaleDateString()
                  : "—"
              }
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SettingField({
  label,
  value,
  onChange,
  readOnly,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        {hint && <span className="text-[10px] font-mono text-muted-foreground/70">{hint}</span>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        className={`w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-cyber focus:ring-1 focus:ring-cyber transition ${
          readOnly ? "text-muted-foreground cursor-not-allowed" : "text-foreground"
        }`}
      />
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="panel-2 p-3 flex items-baseline justify-between">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`font-display ${accent ? "text-cyber text-lg" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
