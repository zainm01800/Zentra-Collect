"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LockedFeatureCard } from "@/components/account-plan-ui";
import { requirePlanAccess } from "@/lib/account/access";
import { useLocalAccount } from "@/lib/billing/use-local-account";
import {
  demoBookkeeperClients,
  demoInvoices,
} from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency } from "@/lib/formatters";

export function PortfolioGate() {
  const { account } = useLocalAccount();

  if (account?.planId === "demo") {
    return <DemoPortfolio />;
  }

  const portfolioAccess = requirePlanAccess(account, "bookkeeper_mode");

  if (!account || !portfolioAccess.allowed) {
    return (
      <LockedFeatureCard
        title="Portfolio mode is available on Bookkeeper plans."
        description="Upgrade to manage multiple client ledgers, weekly client summaries, and portfolio-level risk."
        account={account}
        action="bookkeeper_mode"
      />
    );
  }

  return (
    <div className="zn-card p-5">
      <div className="text-[15px] font-semibold mb-1 text-[#1d1813]">Bookkeeper portfolio</div>
      <p className="text-[13px] text-[#6b6253]">
        Portfolio access is enabled for this plan. The full multi-ledger backend
        is still demo-only until real tenancy and database storage are added.
      </p>
    </div>
  );
}

function DemoPortfolio() {
  const clients = demoBookkeeperClients.map((client) => {
    const invoices = demoInvoices.filter(
      (invoice) => invoice.businessId === client.business.id,
    );
    const overdueAmount = invoices.reduce(
      (total, invoice) => total + invoice.amountOutstanding,
      0,
    );
    const exceptions = invoices.filter((invoice) =>
      ["disputed", "awaiting_remittance", "needs_ap_contact"].includes(
        invoice.status,
      ),
    ).length;
    const missedPromises = invoices.filter(
      (invoice) => invoice.status === "missed_promise",
    ).length;

    return {
      ...client,
      overdueAmount,
      actionCount: invoices.filter((i) => i.amountOutstanding > 0).length,
      exceptions,
      missedPromises,
      risk:
        exceptions + missedPromises >= 3
          ? "high"
          : exceptions + missedPromises >= 1
            ? "med"
            : "low",
    };
  });

  const totalOverdue = clients.reduce(
    (total, client) => total + client.overdueAmount,
    0,
  );
  const totalActions = clients.reduce(
    (total, client) => total + client.actionCount,
    0,
  );
  const totalExceptions = clients.reduce(
    (total, client) => total + client.exceptions,
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="zn-label mb-1.5">Bookkeeper mode</div>
        <h1 className="zn-page-h1">Client portfolio</h1>
        <p className="mt-1.5 max-w-[580px] text-[13.5px] text-[#6b6253]">
          One pane across every client ledger. Spot the ones that need you today.
        </p>
      </section>

      {/* Summary stats */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="zn-stat">
          <div className="zn-label">Clients</div>
          <div className="zn-stat-num mt-2">{clients.length}</div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Total overdue</div>
          <div className="zn-stat-num mt-2" style={{ color: "var(--zn-accent)" }}>
            {formatCurrency(totalOverdue)}
          </div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Actions today</div>
          <div className="zn-stat-num mt-2">{totalActions}</div>
        </div>
        <div className="zn-stat">
          <div className="zn-label">Exceptions</div>
          <div className="zn-stat-num mt-2" style={{ color: "var(--zn-risk)" }}>
            {totalExceptions}
          </div>
        </div>
      </div>

      {/* Client cards grid */}
      <section className="grid gap-3.5 lg:grid-cols-2">
        {clients.map((client) => {
          const initials = client.business.name
            .split(/\s+/)
            .slice(0, 2)
            .map((p) => p[0])
            .join("")
            .toUpperCase();
          const riskClass =
            client.risk === "high"
              ? "zn-risk-high"
              : client.risk === "med"
                ? "zn-risk-med"
                : "zn-risk-low";
          const riskLabel =
            client.risk === "high"
              ? "High risk"
              : client.risk === "med"
                ? "Medium risk"
                : "Low risk";
          return (
            <div key={client.id} className="zn-card p-[18px]">
              <div className="flex items-start justify-between gap-3 mb-3.5">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="size-9 rounded-lg inline-flex items-center justify-center text-[12px] font-semibold flex-shrink-0"
                    style={{
                      background: "var(--zn-accent)",
                      color: "var(--zn-accent-ink)",
                    }}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#1d1813] truncate">
                      {client.business.name}
                    </div>
                    <div className="text-[12px] text-[#6b6253] truncate">
                      {client.portfolioLabel} · {client.primaryContactName}
                    </div>
                  </div>
                </div>
                <span className={`zn-risk-chip ${riskClass} flex-shrink-0`}>
                  <span className="zn-risk-dot" />
                  {riskLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-3.5">
                {[
                  { label: "Overdue", value: formatCurrency(client.overdueAmount), tone: "var(--zn-accent)" },
                  { label: "Actions", value: String(client.actionCount), tone: "var(--zn-ink)" },
                  { label: "Exceptions", value: String(client.exceptions), tone: client.exceptions > 0 ? "var(--zn-risk)" : "var(--zn-ink)" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-[10px] p-2.5"
                    style={{
                      background: "var(--zn-surface-2)",
                      border: "1px solid var(--zn-line-soft)",
                    }}
                  >
                    <div className="zn-label !p-0" style={{ fontSize: 9.5 }}>{s.label}</div>
                    <div className="text-[16px] font-semibold tabular-nums mt-1" style={{ color: s.tone }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/dashboard"
                className="zn-pill zn-pill-ghost w-full justify-center"
              >
                Open sample chase plan
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          );
        })}
      </section>
    </div>
  );
}
