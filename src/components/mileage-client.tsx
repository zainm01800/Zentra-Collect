"use client";

import { useEffect, useMemo, useState } from "react";
import { Car, Plus, Trash2 } from "lucide-react";
import {
  addTrip,
  calcMileageAllowance,
  deleteTrip,
  readTrips,
  type MileageTrip,
} from "@/lib/mileage";
import { currentUkTaxYear, ukTaxYearRange } from "@/lib/tax/uk-self-employed";
import { SectionCsvImport } from "@/components/section-csv-import";
import type { ImportResult } from "@/components/section-csv-import";

function fmtGBP(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateDisplay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function MileageClient() {
  const [trips, setTrips] = useState<MileageTrip[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    date:    fmtDateInput(new Date()),
    miles:   "",
    purpose: "",
    fromTo:  "",
  });

  useEffect(() => {
    setTrips(readTrips());
    setMounted(true);
    function refresh() { setTrips(readTrips()); }
    window.addEventListener("zentra:mileage-change", refresh);
    return () => window.removeEventListener("zentra:mileage-change", refresh);
  }, []);

  // Tax-year stats — what HMRC will care about
  const taxYearStats = useMemo(() => {
    const { startIso, endIso } = ukTaxYearRange(currentUkTaxYear());
    const start = new Date(startIso).getTime();
    const end   = new Date(endIso).getTime() + 86_399_000;
    const inRange = trips.filter((t) => {
      const ts = new Date(t.date).getTime();
      return Number.isFinite(ts) && ts >= start && ts <= end;
    });
    const totalMiles = inRange.reduce((s, t) => s + (Number.isFinite(t.miles) ? t.miles : 0), 0);
    const calc = calcMileageAllowance(totalMiles);
    return { trips: inRange, ...calc };
  }, [trips]);

  function handleCsvImport(result: ImportResult) {
    const today = new Date().toISOString().slice(0, 10);
    for (const row of result.rows) {
      const rawDate = row.date ?? "";
      const dm = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const date = dm
        ? `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`
        : /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;

      const miles = parseFloat((row.miles ?? "").replace(/[,\s]/g, ""));
      if (!Number.isFinite(miles) || miles <= 0) continue;
      const purpose = (row.purpose ?? "").trim();
      if (!purpose) continue;

      addTrip({ date, miles, purpose, fromTo: (row.fromTo ?? "").trim() || undefined });
    }
    setTrips(readTrips());
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const miles = parseFloat(form.miles);
    if (!Number.isFinite(miles) || miles <= 0) return;
    if (!form.purpose.trim()) return;
    addTrip({
      date:    form.date,
      miles,
      purpose: form.purpose.trim(),
      fromTo:  form.fromTo.trim() || undefined,
    });
    setForm({ date: fmtDateInput(new Date()), miles: "", purpose: "", fromTo: "" });
    setShowAdd(false);
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* Tax year stats */}
      <div
        className="grid gap-3 sm:grid-cols-3 rounded-2xl p-5"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        <Stat
          label={`Miles in ${currentUkTaxYear()}`}
          value={taxYearStats.miles.toLocaleString("en-GB")}
          hint={`${taxYearStats.trips.length} trip${taxYearStats.trips.length === 1 ? "" : "s"}`}
        />
        <Stat
          label="HMRC allowance"
          value={fmtGBP(taxYearStats.allowance)}
          hint="Counts as an expense in your tax estimate"
          accent
        />
        <Stat
          label="Rate breakdown"
          value={
            taxYearStats.secondBandMiles > 0
              ? `${taxYearStats.firstBandMiles.toLocaleString("en-GB")} × 45p · ${taxYearStats.secondBandMiles.toLocaleString("en-GB")} × 25p`
              : `${taxYearStats.firstBandMiles.toLocaleString("en-GB")} × 45p`
          }
          hint="First 10,000 miles at 45p, then 25p"
        />
      </div>

      {/* Add trip button / form */}
      {!showAdd ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="zn-pill self-start"
            style={{ height: 36, padding: "0 16px", fontSize: 13 }}
          >
            <Plus className="size-3.5" /> Log a trip
          </button>
          <SectionCsvImport
            title="Mileage"
            fields={[
              { key: "date",    label: "Date",    synonyms: ["date", "trip date", "journey date", "travel date"],                         required: true  },
              { key: "miles",   label: "Miles",   synonyms: ["miles", "mileage", "distance", "mi", "km", "kms", "odometer"],              required: true  },
              { key: "purpose", label: "Purpose", synonyms: ["purpose", "reason", "description", "journey", "trip", "details", "notes"],  required: true  },
              { key: "fromTo",  label: "From → To", synonyms: ["from to", "from/to", "route", "from", "journey from", "origin", "destination"] },
            ]}
            onImport={handleCsvImport}
            example="Date, Miles, Purpose, From/To"
            sampleRows={[
              ["15/04/2026", "42", "Client meeting — Hargreaves Joinery", "London → Birmingham"],
              ["10/04/2026", "18", "Site survey — BluePeak Ltd", "Office → Canary Wharf"],
              ["03/04/2026", "67", "Quarterly review — Oaktree", "London → Manchester"],
              ["28/03/2026", "12", "Workshop — Meridian Studio", "Office → Hoxton"],
              ["20/03/2026", "94", "Training day — Apex Conference Centre", "London → Bristol"],
            ]}
          />
        </div>
      ) : (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl p-5 grid gap-3 sm:grid-cols-[140px_120px_1fr_1fr_auto]"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          <Field label="Date">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-[10px] border px-3 py-2 text-[13px]"
              style={{
                background: "var(--zn-surface)",
                borderColor: "var(--zn-line)",
                color: "var(--zn-ink)",
              }}
            />
          </Field>
          <Field label="Miles">
            <input
              type="number"
              min="0"
              step="0.1"
              required
              value={form.miles}
              onChange={(e) => setForm({ ...form, miles: e.target.value })}
              placeholder="42"
              className="w-full rounded-[10px] border px-3 py-2 text-[13px]"
              style={{
                background: "var(--zn-surface)",
                borderColor: "var(--zn-line)",
                color: "var(--zn-ink)",
              }}
            />
          </Field>
          <Field label="Purpose">
            <input
              type="text"
              required
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="Driving lesson, site visit, client meeting…"
              className="w-full rounded-[10px] border px-3 py-2 text-[13px]"
              style={{
                background: "var(--zn-surface)",
                borderColor: "var(--zn-line)",
                color: "var(--zn-ink)",
              }}
            />
          </Field>
          <Field label="From → to (optional)">
            <input
              type="text"
              value={form.fromTo}
              onChange={(e) => setForm({ ...form, fromTo: e.target.value })}
              placeholder="Reading → Slough"
              className="w-full rounded-[10px] border px-3 py-2 text-[13px]"
              style={{
                background: "var(--zn-surface)",
                borderColor: "var(--zn-line)",
                color: "var(--zn-ink)",
              }}
            />
          </Field>
          <div className="flex items-end gap-2">
            <button type="submit" className="zn-pill" style={{ height: 36, padding: "0 14px", fontSize: 13 }}>
              Save
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="zn-pill zn-pill-ghost"
              style={{ height: 36, padding: "0 12px", fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Trip list */}
      {trips.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl p-10 text-center"
          style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
        >
          <Car className="size-6" style={{ color: "var(--zn-ink-3)" }} />
          <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            No trips logged yet.
          </p>
          <p className="text-[12.5px] max-w-sm" style={{ color: "var(--zn-ink-3)" }}>
            Add your first business journey. We&apos;ll apply HMRC&apos;s
            approved mileage rate and roll the cost into your
            Self-Assessment estimate.
          </p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
        >
          {trips.map((trip, idx) => {
            const allowance = calcMileageAllowance(trip.miles).allowance;
            return (
              <div
                key={trip.id}
                className="flex items-start gap-3 px-5 py-3.5"
                style={{ borderTop: idx === 0 ? "none" : "1px solid var(--zn-line-soft)" }}
              >
                <Car className="size-4 flex-shrink-0 mt-0.5" style={{ color: "var(--zn-ink-3)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                      {trip.purpose}
                    </p>
                    <span className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                      {fmtDateDisplay(trip.date)}
                    </span>
                  </div>
                  {trip.fromTo && (
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      {trip.fromTo}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[13.5px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>
                    {trip.miles.toLocaleString("en-GB")} mi
                  </p>
                  <p className="text-[11.5px] tabular-nums" style={{ color: "var(--zn-accent)" }}>
                    {fmtGBP(allowance)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteTrip(trip.id)}
                  className="ml-2 mt-0.5 rounded p-1 hover:bg-black/5 dark:hover:bg-white/5"
                  aria-label={`Delete trip ${trip.purpose}`}
                >
                  <Trash2 className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label, value, hint, accent,
}: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div>
      <p
        className="text-[10.5px] font-semibold uppercase tracking-[0.1em]"
        style={{ color: "var(--zn-ink-3)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[22px] font-semibold tabular-nums leading-tight"
        style={{ color: accent ? "var(--zn-accent)" : "var(--zn-ink)" }}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
