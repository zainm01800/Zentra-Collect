"use client";

/**
 * /demo/mileage — read-only mileage tracker using purely fake data.
 * No localStorage writes, no Supabase. Tagging/adding is disabled.
 */

import { Car } from "lucide-react";
import { demoMileageTrips } from "@/lib/demo-data/demo-books-data";
import { calcMileageAllowance } from "@/lib/mileage";

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DemoMileagePage() {
  const totalMiles = demoMileageTrips.reduce((s, t) => s + t.miles, 0);
  const calc = calcMileageAllowance(totalMiles);

  return (
    <div className="space-y-6">
      <div>
        <p className="zn-section-label">Demo · Books</p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-[1.1] mt-1"
            style={{ color: "var(--zn-ink)" }}>
          Mileage
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          HMRC mileage allowance · 45p/mile up to 10,000, 25p after
        </p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total miles"   value={totalMiles.toLocaleString()} />
        <Stat label="Allowance"     value={fmtGBP(calc.allowance)} accent="var(--zn-accent)" />
        <Stat label="At 45p band"   value={`${calc.firstBandMiles.toLocaleString()} mi`} />
        <Stat label="At 25p band"   value={`${calc.secondBandMiles.toLocaleString()} mi`} />
      </div>

      {/* Trip list */}
      <div className="zn-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b"
             style={{ borderColor: "var(--zn-line-soft)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Trips this tax year
          </p>
          <button
            type="button"
            disabled
            title="Disabled in demo — sign up to log real trips"
            className="zn-pill zn-pill-ghost opacity-50 cursor-not-allowed text-[12px]"
            style={{ height: 30 }}
          >
            <Car className="size-3.5" /> Add trip
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {demoMileageTrips.map((t) => {
            const allowance = calcMileageAllowance(t.miles).allowance;
            return (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-16 text-[11.5px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                  {fmtDate(t.date)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                    {t.purpose}
                  </p>
                  {t.fromTo && (
                    <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      {t.fromTo}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                    {t.miles} mi
                  </p>
                  <p className="text-[11px] tabular-nums" style={{ color: "var(--zn-ink-3)" }}>
                    {fmtGBP(allowance)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="zn-card p-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em]"
         style={{ color: "var(--zn-ink-3)" }}>{label}</p>
      <p className="mt-2 text-[22px] font-bold tabular-nums leading-none"
         style={{ color: accent ?? "var(--zn-ink)" }}>{value}</p>
    </div>
  );
}
