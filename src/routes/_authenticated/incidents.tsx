import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { PageHeader, Panel } from "./dashboard";

export const Route = createFileRoute("/_authenticated/incidents")({
  head: () => ({
    meta: [{ title: "Incident Lab · ti3lab" }, { name: "robots", content: "noindex" }],
  }),
  component: IncidentLab,
});

function IncidentLab() {
  return (
    <div>
      <PageHeader
        eyebrow="Module · IR-003"
        title="Incident Lab"
        subtitle="Not built yet — this module is intentionally empty rather than filled with fake data."
      />
      <div className="px-4 lg:px-8 py-6">
        <Panel title="Coming Soon" code="IR-003">
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-md">
              The full-incident simulation module isn't built yet. Rather than show you placeholder
              numbers, this page stays empty until it's wired to real data — same as the Log
              Workbench.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
