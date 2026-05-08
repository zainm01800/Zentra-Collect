import { AppShell } from "@/components/app-shell";
import { SettingsTabNav } from "@/components/settings-tab-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="space-y-0">
        <div className="pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            Configuration
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
            Settings
          </h1>
        </div>
        <SettingsTabNav />
        <div className="pt-6">{children}</div>
      </div>
    </AppShell>
  );
}
