"use client";

/**
 * Client-side gate for /portfolio/counterparties.
 *
 * Uses useLocalAccount() — the same hook PortfolioGate reads — so the
 * Portfolio and Counterparties pages always agree on whether the user
 * has access. Fixes audit issue #2 where the two routes used different
 * plan-detection paths (one client + real plan, one server + demo
 * snapshot) and disagreed for real users.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CounterpartyGraphView } from "@/components/counterparty-graph";
import { useLocalAccount } from "@/lib/billing/use-local-account";

const BOOKKEEPER_PLAN_IDS = ["founding_bookkeeper", "bookkeeper_starter", "bookkeeper_pro", "demo"];

export function CounterpartiesGate() {
  const { account } = useLocalAccount();
  const planId = account?.planId;
  // Demo and any bookkeeper-tier plan get access. Null is treated as
  // allowed too (matches PortfolioGate's behaviour) — the page itself
  // will render an empty state if there's no data.
  const allowed = !planId || BOOKKEEPER_PLAN_IDS.includes(planId);

  if (!allowed) {
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
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <h1 className="text-[20px] font-semibold mb-2" style={{ color: "var(--zn-ink)" }}>
            Counterparty exposure is a Practice feature
          </h1>
          <p className="text-[13.5px] max-w-md mx-auto mb-5" style={{ color: "var(--zn-ink-3)" }}>
            Cross-ledger counterparty intelligence is only useful when you manage
            multiple client ledgers. Upgrade to Practice (£119/mo) for up to 5
            ledgers, or Practice Pro (£249/mo) for 20.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            Compare plans →
          </Link>
        </div>
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
