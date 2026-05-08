import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PortfolioPreviewBanner,
} from "@/components/access/upgrade-screen";
import {
  requireFeature,
  getRedirectOrUpgradePrompt,
} from "@/lib/access/features";
import { getUsageSnapshot, DEMO_ACCOUNT_ID } from "@/lib/usage/store";
import {
  groupActionsByCategory,
  rankCollectionActions,
} from "@/lib/collections/decision-engine";
import {
  demoBookkeeperBusiness,
  demoBookkeeperClients,
  demoCustomerBehaviourProfiles,
  demoCustomers,
  demoInvoices,
} from "@/lib/demo-data/zentra-demo-data";
import { formatCurrency } from "@/lib/formatters";
import type { BookkeeperClient } from "@/types/zentra";

// TODO: Replace with server-side date from the database / request context
const REFERENCE_DATE = "2026-05-07";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type ClientStats = {
  client: BookkeeperClient;
  totalOverdue: number;
  actionsToday: number;
  exceptions: number;
  missedPromises: number;
  promisesToCheck: number;
  riskLevel: RiskLevel;
};

function getClientStats(client: BookkeeperClient): ClientStats {
  // TODO: Replace with DB queries filtered by bookkeeperClientId
  const clientInvoices = demoInvoices.filter(
    (inv) => inv.bookkeeperClientId === client.id,
  );
  const clientCustomers = demoCustomers.filter(
    (c) => c.businessId === client.business.id,
  );
  const clientProfiles = demoCustomerBehaviourProfiles.filter((p) =>
    clientCustomers.some((c) => c.id === p.customerId),
  );

  const plan = rankCollectionActions({
    invoices: clientInvoices,
    customers: clientCustomers,
    customerBehaviourProfiles: clientProfiles,
    referenceDate: REFERENCE_DATE,
  });

  const groups = groupActionsByCategory(plan);

  const totalOverdue = clientInvoices
    .filter((inv) => inv.amountOutstanding > 0 && inv.status !== "paid")
    .reduce((sum, inv) => sum + inv.amountOutstanding, 0);

  const missedPromises = clientInvoices.filter(
    (inv) => inv.status === "missed_promise",
  ).length;

  const hasCritical = groups.chase_now.some(
    (item) => item.urgencyLevel === "critical",
  );
  const hasHigh = groups.chase_now.some((item) => item.urgencyLevel === "high");

  const riskLevel: RiskLevel =
    hasCritical || missedPromises >= 2
      ? "CRITICAL"
      : hasHigh || missedPromises >= 1
        ? "HIGH"
        : groups.exceptions_to_resolve.length >= 2
          ? "MEDIUM"
          : totalOverdue > 0
            ? "MEDIUM"
            : "LOW";

  return {
    client,
    totalOverdue,
    actionsToday: groups.chase_now.length,
    exceptions: groups.exceptions_to_resolve.length,
    missedPromises,
    promisesToCheck: groups.promises_to_check.length,
    riskLevel,
  };
}

const riskOrder: Record<RiskLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

function riskBadgeClass(risk: RiskLevel) {
  if (risk === "CRITICAL") return "border-red-200 bg-red-50 text-red-700";
  if (risk === "HIGH") return "border-orange-200 bg-orange-50 text-orange-700";
  if (risk === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function PortfolioPage() {
  // TODO: Replace DEMO_ACCOUNT_ID with session.user.accountId once auth is live
  const snapshot = getUsageSnapshot(DEMO_ACCOUNT_ID);
  const access = requireFeature(snapshot, "bookkeeper_portfolio");

  // Soft gate: non-bookkeeper plans see demo data with an upgrade banner.
  // This lets them evaluate the feature before committing — per product spec.
  const isPreviewMode = !access.allowed;
  const previewConfig = isPreviewMode
    ? getRedirectOrUpgradePrompt(snapshot, "bookkeeper_portfolio")!
    : null;

  // TODO: Replace with DB query for the authenticated bookkeeper's clients
  const clientStats = demoBookkeeperClients
    .map(getClientStats)
    .sort(
      (a, b) =>
        riskOrder[b.riskLevel] - riskOrder[a.riskLevel] ||
        b.totalOverdue - a.totalOverdue,
    );

  const totalOverdue = clientStats.reduce((sum, s) => sum + s.totalOverdue, 0);
  const totalActions = clientStats.reduce((sum, s) => sum + s.actionsToday, 0);
  const totalExceptions = clientStats.reduce(
    (sum, s) => sum + s.exceptions,
    0,
  );
  const totalPromises = clientStats.reduce(
    (sum, s) => sum + s.promisesToCheck + s.missedPromises,
    0,
  );
  const highestRisk = clientStats[0];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Upgrade banner for non-bookkeeper plans (soft gate) */}
        {isPreviewMode && previewConfig && (
          <PortfolioPreviewBanner
            config={previewConfig}
            isSinglePlan={snapshot.planId === "single"}
          />
        )}

        {/* Header */}
        <div className="flex flex-col gap-2 border-b border-black/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Bookkeeper portfolio
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-neutral-950">
              Portfolio overview
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {demoBookkeeperBusiness.name} &middot;{" "}
              {demoBookkeeperClients.length} client businesses &middot;{" "}
              {REFERENCE_DATE}
              {isPreviewMode && (
                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                  Demo data
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Summary stat cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="rounded-xl border-black/8">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Total overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-red-600">
                {formatCurrency(totalOverdue)}
              </div>
              <p className="mt-1 text-xs text-neutral-400">Across all clients</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-black/8">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Actions today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">
                {totalActions}
              </div>
              <p className="mt-1 text-xs text-neutral-400">Chase-now items</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-black/8">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Exceptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">
                {totalExceptions}
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Disputes, remittance, missing contacts
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-black/8">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Promises to check
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight">
                {totalPromises}
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Open &amp; missed promises
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-red-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Highest risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-base font-semibold leading-snug">
                {highestRisk.client.business.name}
              </div>
              <Badge
                variant="outline"
                className={`mt-1.5 ${riskBadgeClass(highestRisk.riskLevel)}`}
              >
                {highestRisk.riskLevel}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Client ledger table */}
        <div>
          <h2 className="mb-3 text-base font-semibold text-neutral-950">
            Client ledgers
          </h2>
          <div className="overflow-x-auto rounded-xl border border-black/8 bg-white">
            <table className="min-w-full divide-y divide-black/6 text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-neutral-400">
                  <th className="px-4 py-3">Business</th>
                  <th className="px-4 py-3 text-right">Overdue</th>
                  <th className="px-4 py-3 text-right">Actions today</th>
                  <th className="px-4 py-3 text-right">Exceptions</th>
                  <th className="px-4 py-3 text-right">Missed promises</th>
                  <th className="px-4 py-3">Last import</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/6">
                {clientStats.map((stats) => (
                  <tr
                    key={stats.client.id}
                    className="transition-colors hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-950">
                        {stats.client.business.name}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {stats.client.portfolioLabel} &middot;{" "}
                        {stats.client.primaryContactName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {stats.totalOverdue > 0
                        ? formatCurrency(stats.totalOverdue)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {stats.actionsToday > 0 ? (
                        <span className="font-semibold text-neutral-950">
                          {stats.actionsToday}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {stats.exceptions > 0 ? (
                        <span className="font-semibold text-amber-700">
                          {stats.exceptions}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {stats.missedPromises > 0 ? (
                        <span className="font-semibold text-red-600">
                          {stats.missedPromises}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-400">
                      {/* TODO: Replace with client.lastImportBatchId lookup from DB */}
                      7 May 2026
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={riskBadgeClass(stats.riskLevel)}
                      >
                        {stats.riskLevel}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {isPreviewMode ? (
                        // In preview mode, link to upgrade instead of drilling into client
                        <Button asChild variant="ghost" size="sm" className="text-neutral-400">
                          <Link href="/request-access">
                            Upgrade to open
                            <ArrowRight className="size-3" />
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/portfolio/${stats.client.id}`}>
                            Open plan
                            <ArrowRight className="size-3" />
                          </Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
