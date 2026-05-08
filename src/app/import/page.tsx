import { AppShell } from "@/components/app-shell";
import { ZentraImportFlow } from "@/components/zentra-import-flow";
import { UpgradeScreen } from "@/components/access/upgrade-screen";
import { requireFeature, getRedirectOrUpgradePrompt } from "@/lib/access/features";
import { getUsageSnapshot, DEMO_ACCOUNT_ID } from "@/lib/usage/store";

export default function ImportPage() {
  // TODO: Replace DEMO_ACCOUNT_ID with session.user.accountId once auth is live
  const snapshot = getUsageSnapshot(DEMO_ACCOUNT_ID);
  const access = requireFeature(snapshot, "real_import");

  if (!access.allowed) {
    const config = getRedirectOrUpgradePrompt(snapshot, "real_import")!;
    return (
      <AppShell>
        <UpgradeScreen feature="real_import" config={config} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ZentraImportFlow />
    </AppShell>
  );
}
