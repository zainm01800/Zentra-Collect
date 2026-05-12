import { ArrowRight, Phone, ShieldAlert, WalletCards } from "lucide-react";
import Link from "next/link";
import type { ElementType } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getTodayPlan } from "@/lib/invoice-logic";
import { formatCurrency } from "@/lib/formatters";
import type { Invoice } from "@/types/cashpilot";

export function TodayPlan({ invoices }: { invoices: Invoice[] }) {
  const plan = getTodayPlan(invoices);

  return (
    <Card className="rounded-lg border-zinc-200 bg-zinc-950 text-white">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_360px] lg:p-6">
        <div>
          <p className="text-sm font-medium text-zinc-400">Recommended plan</p>
          <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight">
            {plan.headline}
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">{plan.detail}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="h-9 bg-white dark:bg-[#211d17] text-zinc-950 hover:bg-zinc-200">
              <Link href="/chase-today">
                Work the queue
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <p className="flex items-center text-sm text-zinc-300">
              {plan.nextBestAction}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <PlanStat
            icon={WalletCards}
            label="High-risk amount"
            value={formatCurrency(plan.highRiskAmount)}
          />
          <PlanStat icon={Phone} label="Calls recommended" value={String(plan.callCount)} />
          <PlanStat
            icon={ShieldAlert}
            label="Blocked items"
            value={String(plan.disputeCount)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PlanStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-zinc-400">{label}</span>
        <Icon className="size-4 text-zinc-400" />
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
