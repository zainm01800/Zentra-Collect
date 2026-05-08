import { AppShell } from "@/components/app-shell";
import { ZentraWeeklyDigest } from "@/components/zentra-weekly-digest";
import { DemoCompactBanner } from "@/components/demo-banner";
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
      <div className="space-y-6">
        {/* Demo banner — shown only for demo tier (sample data context) */}
        {snapshot.tier === "free" && (
          <DemoCompactBanner message="You're viewing a sample weekly digest. Start a trial to generate one from your own invoices." />
        )}
        <ZentraWeeklyDigest />
      </div>
    </AppShell>
  );
}
