import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SettingsTabNav } from "@/components/settings-tab-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Workspace configuration"
          title="Settings"
          sub="Tone defaults, integrations, plan, and account preferences."
        />
        <SettingsTabNav />
        <div>{children}</div>
      </div>
    </AppShell>
  );
}
