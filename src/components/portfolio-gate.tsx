"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LockedFeatureCard } from "@/components/account-plan-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="rounded-3xl border-black/10 bg-white/70 shadow-none">
      <CardHeader>
        <CardTitle>Bookkeeper portfolio</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-6 text-neutral-600">
        Portfolio access is enabled for this plan. The full multi-ledger backend
        is still demo-only until real tenancy and database storage are added.
      </CardContent>
    </Card>
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
      actionCount: invoices.filter((invoice) => invoice.amountOutstanding > 0).length,
      exceptions,
      missedPromises,
      risk:
        exceptions + missedPromises >= 3
          ? "High"
          : exceptions + missedPromises >= 1
            ? "Medium"
            : "Low",
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

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-black/10 bg-white/70 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Demo portfolio
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Sample bookkeeper portfolio
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
          This is sample data only. You can explore how Zentra ranks client
          ledgers, but demo mode does not create permanent client records.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <PortfolioStat label="Total overdue" value={formatCurrency(totalOverdue)} />
          <PortfolioStat label="Actions today" value={String(totalActions)} />
          <PortfolioStat label="Client ledgers" value={String(clients.length)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {clients.map((client) => (
          <Card key={client.id} className="rounded-3xl border-black/10 bg-white/70 shadow-none">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{client.business.name}</CardTitle>
                  <p className="mt-1 text-sm text-neutral-500">
                    {client.portfolioLabel} - {client.primaryContactName}
                  </p>
                </div>
                <span className="rounded-full border border-black/10 bg-[#fbf8f1] px-3 py-1 text-xs font-medium text-neutral-600">
                  {client.risk} risk
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <PortfolioStat label="Overdue" value={formatCurrency(client.overdueAmount)} />
                <PortfolioStat label="Actions" value={String(client.actionCount)} />
                <PortfolioStat label="Exceptions" value={String(client.exceptions)} />
              </div>
              <Button asChild variant="outline" className="rounded-full border-black/10 bg-transparent">
                <Link href="/dashboard">
                  Open sample chase plan
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}

function PortfolioStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-[#fbf8f1] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-neutral-950">{value}</p>
    </div>
  );
}
