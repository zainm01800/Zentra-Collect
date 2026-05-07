import { AppShell } from "@/components/app-shell";
import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Workspace configuration
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1>
        </div>
        <SettingsForm />
      </div>
    </AppShell>
  );
}
