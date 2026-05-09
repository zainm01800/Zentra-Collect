import { AppShell } from "@/components/app-shell";
import { SettingsTabNav } from "@/components/settings-tab-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="space-y-0">
        <div className="pb-5">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">
            Settings
          </h1>
        </div>
        <SettingsTabNav />
        <div className="pt-6">{children}</div>
      </div>
    </AppShell>
  );
}
