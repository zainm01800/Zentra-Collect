import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getPlanConfig,
  getPlanLimit,
  type LimitValue,
  type PlanId,
} from "@/lib/account/plans";

const visiblePlans: PlanId[] = [
  "DEMO",
  "TRIAL",
  "STARTER_SOLO",
  "SINGLE_BUSINESS",
  "BOOKKEEPER_STARTER",
  "BOOKKEEPER_PRO",
];

export function PricingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {visiblePlans.map((planId) => {
        const plan = getPlanConfig(planId);

        return (
          <Card
            key={plan.id}
            className={
              plan.id === "SINGLE_BUSINESS"
                ? "rounded-3xl border-zinc-950 bg-white"
                : "rounded-3xl border-black/10 bg-white/75"
            }
          >
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-semibold tracking-tight">
                  {formatPrice(plan.id)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <div className="space-y-2 text-sm">
                {getPlanBullets(plan.id).map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-600" />
                    {feature}
                  </div>
                ))}
              </div>
              <Button
                className="w-full rounded-full"
                variant={plan.id === "SINGLE_BUSINESS" ? "default" : "outline"}
              >
                {plan.id === "DEMO"
                  ? "Try demo"
                  : plan.id === "TRIAL"
                    ? "Start trial"
                    : "View plan"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function formatPrice(planId: PlanId) {
  const plan = getPlanConfig(planId);
  if (plan.priceMonthlyGbp === 0) return "\u00a30";
  return `\u00a3${plan.priceMonthlyGbp}/month`;
}

function formatLimit(value: LimitValue) {
  return value === "unlimited" ? "unlimited" : value.toLocaleString("en-GB");
}

function getPlanBullets(planId: PlanId) {
  const clientLedgers = getPlanLimit(planId, "clientLedgerCount");
  const activeInvoices = getPlanLimit(planId, "activeInvoiceCount");
  const imports =
    planId === "TRIAL"
      ? getPlanLimit(planId, "trialImportsUsed")
      : getPlanLimit(planId, "importsUsedThisMonth");
  const aiActions =
    planId === "TRIAL"
      ? getPlanLimit(planId, "trialAiActionsUsed")
      : getPlanLimit(planId, "aiActionsUsedThisMonth");

  if (planId === "DEMO") {
    return [
      "sample data only",
      `${formatLimit(aiActions)} sample AI drafts`,
    ];
  }

  if (planId === "TRIAL") {
    return [
      "no card required",
      `${formatLimit(clientLedgers)} business`,
      `${formatLimit(activeInvoices)} active invoices`,
      `${formatLimit(imports)} imports`,
      `${formatLimit(aiActions)} AI actions`,
    ];
  }

  return [
    getPlanConfig(planId).features.bookkeeperMode
      ? `up to ${formatLimit(clientLedgers)} client ledgers`
      : `${formatLimit(clientLedgers)} business`,
    `${formatLimit(activeInvoices)} active invoices`,
    `${formatLimit(imports)} imports/month`,
    `${formatLimit(aiActions)} AI actions/month`,
  ];
}
