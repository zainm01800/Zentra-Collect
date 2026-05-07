"use client";

import Link from "next/link";
import { ArrowLeft, FileSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  importDiffStorageKey,
  importSummaryStorageKey,
  type ImportChange,
  type ImportDiffOutput,
  type ImportSummary,
} from "@/lib/import/zentra-import";

export function ZentraImportSummary() {
  const summary = readStored<ImportSummary>(importSummaryStorageKey);
  const diff = readStored<ImportDiffOutput>(importDiffStorageKey) ?? summary?.diff;

  if (!summary || !diff) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-lg rounded-3xl border-black/10 bg-white/75 text-center shadow-none ring-0">
          <CardHeader>
            <FileSearch className="mx-auto size-9 text-neutral-950" />
            <CardTitle className="text-2xl">No import summary yet</CardTitle>
            <CardDescription className="leading-6">
              Upload a newer AR export to compare it with the previous import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-full bg-neutral-950 px-5 text-white">
              <Link href="/import">Import invoices</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 border-b border-black/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Import summary
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-neutral-950 sm:text-5xl">
            What changed since last import
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
            {summary.fileName} imported on {formatDate(summary.importedAt)}.
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-full border-black/10 bg-white/70">
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Paid since last import"
          value={formatCurrency(diff.totalPaidAmount)}
          detail={`${diff.paidSinceLastImport.length} invoices disappeared or went to zero`}
        />
        <SummaryCard
          label="Newly overdue"
          value={String(diff.newlyOverdue.length)}
          detail={formatCurrency(diff.totalNewlyOverdueAmount)}
        />
        <SummaryCard
          label="Still overdue"
          value={String(diff.stillOverdue.length)}
          detail={formatCurrency(diff.totalStillOutstanding)}
        />
        <SummaryCard
          label="Missed promises"
          value={String(diff.promisesMissed.length)}
          detail="Follow up carefully"
        />
        <SummaryCard
          label="Unresolved disputes"
          value={String(diff.disputesStillOpen.length)}
          detail="Resolve before normal chasing"
        />
      </section>

      <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
        <CardHeader>
          <CardTitle>Top changes</CardTitle>
          <CardDescription>
            The most important differences Zentra found between the two imports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeList changes={diff.topChanges} empty="No major changes found." />
        </CardContent>
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChangeSection title="Paid since last import" changes={diff.paidSinceLastImport} />
        <ChangeSection title="Newly overdue" changes={diff.newlyOverdue} />
        <ChangeSection title="Still overdue" changes={diff.stillOverdue.slice(0, 10)} />
        <ChangeSection title="Amount changed" changes={diff.amountChanged} />
        <ChangeSection title="Missed promises" changes={diff.promisesMissed} />
        <ChangeSection title="Unresolved disputes" changes={diff.disputesStillOpen} />
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-2xl border-black/10 bg-white/70 shadow-none ring-0">
      <CardHeader>
        <CardDescription className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-semibold text-neutral-950">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ChangeSection({
  title,
  changes,
}: {
  title: string;
  changes: ImportChange[];
}) {
  return (
    <Card className="rounded-3xl border-black/10 bg-white/75 shadow-none ring-0">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{title}</CardTitle>
          <Badge variant="outline" className="rounded-full border-black/10 bg-[#f7f2ea]">
            {changes.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ChangeList changes={changes} empty="Nothing in this category." />
      </CardContent>
    </Card>
  );
}

function ChangeList({
  changes,
  empty,
}: {
  changes: ImportChange[];
  empty: string;
}) {
  if (!changes.length) {
    return <p className="text-sm text-neutral-500">{empty}</p>;
  }

  return (
    <div className="space-y-2">
      {changes.map((change) => (
        <div
          key={change.id}
          className="rounded-2xl border border-black/10 bg-[#fbf8f1] p-3 text-sm leading-6 text-neutral-700"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-neutral-950">
                {change.customerName} · {change.invoiceNumber}
              </p>
              <p>{change.message}</p>
            </div>
            <Badge variant="outline" className="w-fit rounded-full border-black/10 bg-white/70">
              {change.severity}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function readStored<T>(key: string) {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(key);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}
