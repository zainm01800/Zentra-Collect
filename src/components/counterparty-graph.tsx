"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Mail, Network, Users } from "lucide-react";
import {
  buildCounterpartyGraph,
  type Counterparty,
  type InvoicesByClient,
} from "@/lib/counterparty/graph";
import {
  readBookkeeperClients,
  readClientInvoices,
} from "@/lib/bookkeeper-clients";
import { demoBookkeeperClients, demoInvoices } from "@/lib/demo-data/zentra-demo-data";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style:    "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Loads the per-client invoice lists. Live data first; if the bookkeeper
 * hasn't imported anything yet, falls back to the demo portfolio so the
 * surface still illustrates the feature.
 */
function loadPortfolio(): { sets: InvoicesByClient[]; isDemo: boolean } {
  const clients = readBookkeeperClients();
  if (clients.length > 0) {
    const sets = clients.map((client) => ({
      client:   { id: client.id, name: client.name },
      invoices: readClientInvoices(client.id),
    }));
    return { sets, isDemo: false };
  }
  // Demo fallback — group demo invoices by bookkeeperClientId
  const sets: InvoicesByClient[] = demoBookkeeperClients.map((dc) => ({
    client:   { id: dc.id, name: dc.business.name },
    invoices: demoInvoices.filter((inv) => inv.bookkeeperClientId === dc.id),
  }));
  return { sets, isDemo: true };
}

export function CounterpartyGraphView() {
  const [data, setData] = useState<{ counterparties: Counterparty[]; isDemo: boolean } | null>(null);

  useEffect(() => {
    const { sets, isDemo } = loadPortfolio();
    const counterparties = buildCounterpartyGraph(sets);
    setData({ counterparties, isDemo });
  }, []);

  const totals = useMemo(() => {
    if (!data) return null;
    const exposed = data.counterparties.reduce((s, c) => s + c.totalOutstanding, 0);
    const critical = data.counterparties.filter((c) => c.riskLabel === "critical").length;
    return { exposed, critical, count: data.counterparties.length };
  }, [data]);

  if (!data) {
    return <div className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>Loading…</div>;
  }

  if (data.counterparties.length === 0) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        <Network className="size-6 mx-auto mb-3" style={{ color: "var(--zn-ink-3)" }} />
        <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--zn-ink)" }}>
          No shared counterparties yet
        </h2>
        <p className="text-[12.5px] max-w-md mx-auto" style={{ color: "var(--zn-ink-3)" }}>
          Once two of your client ledgers contain invoices for the same end-customer
          (matched by email or company name), they&rsquo;ll appear here ranked by
          aggregate exposure.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {data.isDemo && (
        <div
          className="rounded-lg px-4 py-3 text-[12.5px] leading-5"
          style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}
        >
          Showing demo portfolio data — your real practice data will populate here
          once you import invoices into two or more client ledgers.
        </div>
      )}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <Summary icon={<Users className="size-4" />} label="Shared counterparties" value={String(totals!.count)} />
        <Summary icon={<Mail className="size-4" />} label="Aggregate exposure"   value={fmtGBP(totals!.exposed)} />
        <Summary icon={<AlertTriangle className="size-4" />} label="Critical"     value={String(totals!.critical)} />
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {data.counterparties.map((c) => (
          <CounterpartyRow key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider mb-1"
           style={{ color: "var(--zn-ink-3)" }}>
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-[20px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
        {value}
      </p>
    </div>
  );
}

function CounterpartyRow({ c }: { c: Counterparty }) {
  const riskColour =
    c.riskLabel === "critical" ? "var(--zn-risk)" :
    c.riskLabel === "high"     ? "var(--zn-warn)" :
                                 "var(--zn-ink-3)";
  const riskBg =
    c.riskLabel === "critical" ? "var(--zn-risk-soft)" :
    c.riskLabel === "high"     ? "var(--zn-warn-soft)" :
                                 "var(--zn-bg-2)";

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              {c.displayName}
            </h3>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: riskBg, color: riskColour }}
            >
              {c.riskLabel}
            </span>
          </div>
          {c.email && (
            <p className="text-[11.5px] mt-0.5 font-mono" style={{ color: "var(--zn-ink-3)" }}>
              {c.email}
            </p>
          )}
          {!c.matchedByEmail && (
            <p className="text-[10.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
              Matched by name — verify these are the same legal entity before acting.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--zn-ink-3)" }}>
            Aggregate exposure
          </p>
          <p className="text-[22px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
            {fmtGBP(c.totalOutstanding)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 text-[12px] mb-3" style={{ color: "var(--zn-ink-2)" }}>
        <Stat label="Your clients" value={String(c.ledgers.length)} />
        <Stat label="Invoices"     value={String(c.totalInvoices)} />
        <Stat label="Overdue"      value={String(c.totalOverdue)} />
        <Stat label="Oldest"       value={`${c.oldestDaysOverdue}d`} />
      </div>

      <div className="border-t pt-3" style={{ borderColor: "var(--zn-line-soft)" }}>
        <p className="text-[10.5px] uppercase tracking-wider mb-2" style={{ color: "var(--zn-ink-3)" }}>
          Owes
        </p>
        <ul className="space-y-1.5">
          {c.ledgers.map((l) => (
            <li key={l.clientId} className="flex items-center justify-between text-[12.5px]">
              <span style={{ color: "var(--zn-ink-2)" }}>
                {l.clientName}{" "}
                <span style={{ color: "var(--zn-ink-3)" }}>
                  ({l.invoiceCount} invoice{l.invoiceCount === 1 ? "" : "s"}{l.overdueCount > 0 ? `, ${l.overdueCount} overdue` : ""})
                </span>
              </span>
              <span className="tabular-nums font-medium" style={{ color: "var(--zn-ink)" }}>
                {fmtGBP(l.outstandingTotal)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <p className="text-[13.5px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}
