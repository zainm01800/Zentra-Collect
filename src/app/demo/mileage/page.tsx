"use client";

import { useState } from "react";
import { Car, Plus, X } from "lucide-react";
import { demoMileageTrips } from "@/lib/demo-data/demo-books-data";
import { calcMileageAllowance } from "@/lib/mileage";

interface Trip {
  id: string;
  date: string;
  purpose: string;
  fromTo?: string;
  miles: number;
}

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const blankForm = { from: "", to: "", miles: "", purpose: "", date: "" };

export default function DemoMileagePage() {
  const [extraTrips, setExtraTrips] = useState<Trip[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");

  const allTrips: Trip[] = [...demoMileageTrips, ...extraTrips];
  const totalMiles = allTrips.reduce((s, t) => s + t.miles, 0);
  const calc = calcMileageAllowance(totalMiles);

  function openModal() { setForm(blankForm); setError(""); setModalOpen(true); }
  function closeModal() { setModalOpen(false); }

  function addTrip() {
    const miles = parseFloat(form.miles);
    if (!form.purpose.trim()) { setError("Purpose is required."); return; }
    if (!miles || miles <= 0) { setError("Enter a valid number of miles."); return; }
    const date = form.date || new Date().toISOString().split("T")[0];
    setExtraTrips((prev) => [
      ...prev,
      {
        id: `demo-${Date.now()}`,
        date,
        purpose: form.purpose.trim(),
        fromTo: form.from && form.to ? `${form.from} → ${form.to}` : undefined,
        miles,
      },
    ]);
    closeModal();
  }

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
            onClick={openModal}
            className="zn-pill zn-pill-ghost text-[12px]"
            style={{ height: 30 }}
          >
            <Plus className="size-3.5" /> Add trip
          </button>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--zn-line-soft)" }}>
          {allTrips.map((t) => {
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

      {/* Add trip modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,0.55)" }}
             role="dialog" aria-modal="true">
          <div className="relative w-full max-w-[420px] rounded-2xl overflow-hidden shadow-2xl"
               style={{ background: "var(--zn-bg)" }}>
            <button type="button" onClick={closeModal} aria-label="Close"
              className="absolute top-4 right-4 size-8 rounded-full inline-flex items-center justify-center hover:bg-black/5"
              style={{ color: "var(--zn-ink-3)" }}>
              <X className="size-4" />
            </button>

            <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Car className="size-4" style={{ color: "var(--zn-accent)" }} />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                   style={{ color: "var(--zn-ink-3)" }}>Log mileage</p>
              </div>
              <h2 className="text-[18px] font-semibold" style={{ color: "var(--zn-ink)" }}>Add a trip</h2>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" value={form.from}
                  onChange={(v) => setForm((f) => ({ ...f, from: v }))}
                  placeholder="e.g. London" />
                <Field label="To" value={form.to}
                  onChange={(v) => setForm((f) => ({ ...f, to: v }))}
                  placeholder="e.g. Birmingham" />
              </div>
              <Field label="Purpose *" value={form.purpose}
                onChange={(v) => setForm((f) => ({ ...f, purpose: v }))}
                placeholder="e.g. Client visit — Acme Ltd" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Miles *" value={form.miles} type="number"
                  onChange={(v) => setForm((f) => ({ ...f, miles: v }))}
                  placeholder="e.g. 42" />
                <Field label="Date" value={form.date} type="date"
                  onChange={(v) => setForm((f) => ({ ...f, date: v }))} />
              </div>
              {error && (
                <p className="text-[12px]" style={{ color: "var(--zn-risk)" }}>{error}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={closeModal}
                  className="zn-pill zn-pill-ghost text-[12.5px]" style={{ height: 34 }}>
                  Cancel
                </button>
                <button type="button" onClick={addTrip}
                  className="zn-pill text-[12.5px]" style={{ height: 34 }}>
                  Add trip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-[0.07em]"
             style={{ color: "var(--zn-ink-3)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border px-3 py-2 text-[13px] outline-none focus:ring-1 w-full"
        style={{
          borderColor: "var(--zn-line-soft)",
          background: "var(--zn-surface)",
          color: "var(--zn-ink)",
        }}
      />
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
