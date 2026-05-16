import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UpgradeScreen } from "@/components/access/upgrade-screen";
import { requireFeature, getRedirectOrUpgradePrompt } from "@/lib/access/features";
import { getUsageSnapshot, DEMO_ACCOUNT_ID } from "@/lib/usage/store";
import { CounterpartyGraphView } from "@/components/counterparty-graph";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Counterparty exposure · Portfolio",
  description: "Cross-ledger view of customers who owe more than one of your clients.",
};

export default function CounterpartiesPage() {
  // TODO: Replace DEMO_ACCOUNT_ID with session.user.accountId once auth is live
  const snapshot = getUsageSnapshot(DEMO_ACCOUNT_ID);
  const access = requireFeature(snapshot, "bookkeeper_portfolio");

  if (!access.allowed) {
    const config = getRedirectOrUpgradePrompt(snapshot, "bookkeeper_portfolio")!;
    return (
      <>
        <div className="mb-4 flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/portfolio">
              <ArrowLeft className="size-3" />
              Back to portfolio
            </Link>
          </Button>
        </div>
        <UpgradeScreen feature="bookkeeper_portfolio" config={config} />
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/portfolio">
            <ArrowLeft className="size-3" />
            Back to portfolio
          </Link>
        </Button>
      </div>

      <div className="mb-5">
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Practice intelligence
        </p>
        <h1
          className="text-[26px] font-semibold mt-1 leading-tight"
          style={{ color: "var(--zn-ink)" }}
        >
          Counterparty exposure
        </h1>
        <p className="mt-1.5 text-[13.5px] max-w-2xl" style={{ color: "var(--zn-ink-3)" }}>
          Customers who owe two or more of your clients. Aggregate exposure surfaces
          risk that&rsquo;s invisible on any single ledger — treat these as priority
          for chasing, and consider sharing intelligence between affected clients.
        </p>
      </div>

      <CounterpartyGraphView />
    </>
  );
}
