import { AppShell } from "@/components/app-shell";
import { ZentraWeeklyDigest } from "@/components/zentra-weekly-digest";
import { UpgradeScreen } from "@/components/access/upgrade-screen";
import { requireFeature, getRedirectOrUpgradePrompt } from "@/lib/access/features";
import { getUsageSnapshot, DEMO_ACCOUNT_ID } from "@/lib/usage/store";

export default function DigestPage() {
  // TODO: Replace DEMO_ACCOUNT_ID with session.user.accountId once auth is live
  const snapshot = getUsageSnapshot(DEMO_ACCOUNT_ID);
  const access = requireFeature(snapshot, "weekly_digest");

  if (!access.allowed) {
    const config = getRedirectOrUpgradePrompt(snapshot, "weekly_digest")!;
    return (
      <AppShell>
        <UpgradeScreen feature="weekly_digest" config={config} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ZentraWeeklyDigest />
    </AppShell>
  );
}
