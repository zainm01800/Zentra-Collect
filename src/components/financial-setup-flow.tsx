"use client";

/**
 * financial-setup-flow.tsx
 *
 * 3-step post-auth onboarding that collects the minimum needed to make
 * Safe to Spend useful: what the person does (role), where they're based
 * (country + tax rate), and how they'll add their invoices.
 *
 * Designed to be rendered at /onboarding once the user has a Supabase
 * account.  Calling upsertFinancialSettings() is best-effort — if it
 * fails (e.g. demo / unauthenticated) the user is still sent on their
 * way to keep the experience frictionless.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FilePlus, Upload } from "lucide-react";
import { upsertFinancialSettings } from "@/actions/financial-settings";

// ── Static data ───────────────────────────────────────────────────────────────

const ROLES = [
  { value: "designer",     label: "Designer" },
  { value: "developer",    label: "Developer" },
  { value: "copywriter",   label: "Copywriter" },
  { value: "consultant",   label: "Consultant" },
  { value: "photographer", label: "Photographer" },
  { value: "bookkeeper",   label: "Bookkeeper" },
  { value: "other",        label: "Other" },
] as const;

const COUNTRIES = [
  { value: "GB", flag: "🇬🇧", label: "UK" },
  { value: "IE", flag: "🇮🇪", label: "Ireland" },
  { value: "US", flag: "🇺🇸", label: "US" },
  { value: "CA", flag: "🇨🇦", label: "Canada" },
  { value: "AU", flag: "🇦🇺", label: "Australia" },
  { value: "XX", flag: "🌍",  label: "Other" },
] as const;

const TAX_MIN     = 10;
const TAX_MAX     = 50;
const TAX_DEFAULT = 20;

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5 mb-8" aria-hidden>
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className="flex-1 h-[3px] rounded-full transition-colors duration-300"
          style={{ background: s <= step ? "var(--zn-accent)" : "var(--zn-line)" }}
        />
      ))}
    </div>
  );
}

// ── Step 1 — Role ─────────────────────────────────────────────────────────────

function Step1({
  role,
  setRole,
}: {
  role: string | null;
  setRole: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1
          className="text-[22px] font-semibold tracking-[-0.02em]"
          style={{ color: "var(--zn-ink)" }}
        >
          What kind of work do you do?
        </h1>
        <p
          className="text-[13.5px] leading-relaxed"
          style={{ color: "var(--zn-ink-3)" }}
        >
          We&apos;ll use this to personalise your experience.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ROLES.map((r) => {
          const selected = role === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className="rounded-[10px] px-3.5 py-2.5 text-[13.5px] font-medium text-left transition-all"
              style={{
                background: selected ? "var(--zn-ink)"      : "var(--zn-surface-2)",
                color:      selected ? "var(--zn-surface)"  : "var(--zn-ink-2)",
                border:     `1px solid ${selected ? "var(--zn-ink)" : "var(--zn-line)"}`,
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2 — Country + tax rate ───────────────────────────────────────────────

function Step2({
  country,
  setCountry,
  taxRate,
  setTaxRate,
}: {
  country: string | null;
  setCountry: (v: string) => void;
  taxRate: number;
  setTaxRate: (v: number) => void;
}) {
  const fillPct = ((taxRate - TAX_MIN) / (TAX_MAX - TAX_MIN)) * 100;

  return (
    <div className="space-y-6">
      {/* Country grid */}
      <div className="space-y-3">
        <h1
          className="text-[22px] font-semibold tracking-[-0.02em]"
          style={{ color: "var(--zn-ink)" }}
        >
          Where are you based?
        </h1>

        <div className="grid grid-cols-3 gap-2">
          {COUNTRIES.map((c) => {
            const selected = country === c.value;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => setCountry(c.value)}
                className="flex flex-col items-center gap-1.5 rounded-[10px] px-2 py-3 transition-all"
                style={{
                  background: selected ? "var(--zn-ink)"  : "var(--zn-surface-2)",
                  border:     `1px solid ${selected ? "var(--zn-ink)" : "var(--zn-line)"}`,
                }}
              >
                <span className="text-[20px] leading-none">{c.flag}</span>
                <span
                  className="text-[12px] font-medium leading-none"
                  style={{ color: selected ? "var(--zn-surface)" : "var(--zn-ink-2)" }}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full" style={{ background: "var(--zn-line-soft)" }} />

      {/* Tax rate slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-[14px] font-semibold"
            style={{ color: "var(--zn-ink)" }}
          >
            Your estimated tax rate
          </span>
          <span
            className="text-[22px] font-bold tabular-nums tracking-tight flex-shrink-0"
            style={{ color: "var(--zn-accent)" }}
          >
            {taxRate}%
          </span>
        </div>

        {/* Slider */}
        <input
          type="range"
          min={TAX_MIN}
          max={TAX_MAX}
          step={1}
          value={taxRate}
          onChange={(e) => setTaxRate(Number(e.target.value))}
          aria-label="Estimated tax rate"
          aria-valuetext={`${taxRate}%`}
          className={[
            "w-full h-[4px] rounded-full cursor-pointer",
            "appearance-none outline-none",
            // Webkit thumb
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-[18px]",
            "[&::-webkit-slider-thumb]:h-[18px]",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-[#1d1813]",
            "[&::-webkit-slider-thumb]:shadow-[0_0_0_3px_#faf5e8,0_0_0_5px_#1d1813]",
            "[&::-webkit-slider-thumb]:cursor-pointer",
            "[&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb:active]:scale-110",
            // Firefox thumb
            "[&::-moz-range-thumb]:w-[18px]",
            "[&::-moz-range-thumb]:h-[18px]",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-[#1d1813]",
            "[&::-moz-range-thumb]:border-0",
            "[&::-moz-range-thumb]:cursor-pointer",
          ].join(" ")}
          style={{
            background: `linear-gradient(to right, var(--zn-accent) 0%, var(--zn-accent) ${fillPct}%, var(--zn-line) ${fillPct}%, var(--zn-line) 100%)`,
          }}
        />

        <div className="flex justify-between">
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            {TAX_MIN}%
          </span>
          <span className="text-[11px]" style={{ color: "var(--zn-ink-3)" }}>
            {TAX_MAX}%
          </span>
        </div>

        <p
          className="text-[12.5px] leading-[1.65]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          We use this to calculate how much to set aside for tax.
          You can change it anytime.
        </p>
      </div>
    </div>
  );
}

// ── Step 3 — Invoice method ───────────────────────────────────────────────────

function ChoiceCard({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ghost,
  isPending,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaLabel: string;
  ghost?: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="rounded-[12px] p-4 space-y-3"
      style={{
        background: "var(--zn-surface-2)",
        border:     "1px solid var(--zn-line)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex size-9 flex-shrink-0 items-center justify-center rounded-[8px]"
          style={{ background: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            {title}
          </p>
          <p
            className="mt-0.5 text-[12.5px] leading-relaxed"
            style={{ color: "var(--zn-ink-3)" }}
          >
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={ghost ? "zn-pill zn-pill-ghost disabled:opacity-50" : "zn-pill disabled:opacity-50"}
        style={{ height: 32, fontSize: 12.5, padding: "0 14px" }}
      >
        {isPending ? "Saving…" : ctaLabel}
        {!ghost && <ArrowRight className="size-3" />}
      </button>
    </div>
  );
}

function Step3({
  isPending,
  onChoose,
}: {
  isPending: boolean;
  onChoose: (destination: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <h1
          className="text-[22px] font-semibold tracking-[-0.02em]"
          style={{ color: "var(--zn-ink)" }}
        >
          How do you want to add your invoices?
        </h1>
        <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--zn-ink-3)" }}>
          You can always do both. Start with whichever is easier.
        </p>
      </div>

      <div className="space-y-3">
        <ChoiceCard
          icon={Upload}
          title="Import from accounting software"
          description="CSV from Xero, QuickBooks, Sage, or FreeAgent. Takes about 2 minutes and pulls everything in at once."
          ctaLabel="Import a file"
          isPending={isPending}
          onClick={() => onChoose("/import")}
        />
        <ChoiceCard
          icon={FilePlus}
          title="Add invoices manually"
          description="One at a time, right here. Great if you only have a handful of open invoices to track."
          ctaLabel="Add one now"
          ghost
          isPending={isPending}
          onClick={() => onChoose("/dashboard?new_invoice=1")}
        />
      </div>
    </div>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export function FinancialSetupFlow() {
  const router = useRouter();
  const [step, setStep]     = useState(1);
  const [role, setRole]     = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState(TAX_DEFAULT);
  const [isPending, startTransition] = useTransition();

  /**
   * Save settings and navigate.  Failure is silently swallowed so a broken
   * Supabase config (or demo mode) never blocks the user from progressing.
   */
  function saveAndGo(destination: string) {
    startTransition(async () => {
      try {
        await upsertFinancialSettings({
          freelancerType: role      ?? "other",
          taxRatePercent: taxRate,
          countryCode:    country   ?? "GB",
        });
      } catch {
        // best-effort
      }
      router.push(destination);
    });
  }

  // Continue is blocked until the required selection is made for the current step.
  const canContinue =
    step === 1 ? role    !== null :
    step === 2 ? country !== null :
    true;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--zn-bg)" }}
    >
      {/* ── Brand mark ──────────────────────────────────────────────────── */}
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <span className="zn-brand-mark">Z</span>
        <span
          className="text-[15px] font-semibold"
          style={{ color: "var(--zn-ink)" }}
        >
          Zentra Collect
        </span>
      </Link>

      {/* ── Card ────────────────────────────────────────────────────────── */}
      <div className="w-full max-w-[500px]">
        <ProgressBar step={step} />

        <div className="zn-card px-6 py-7">
          {step === 1 && (
            <Step1 role={role} setRole={setRole} />
          )}
          {step === 2 && (
            <Step2
              country={country}
              setCountry={setCountry}
              taxRate={taxRate}
              setTaxRate={setTaxRate}
            />
          )}
          {step === 3 && (
            <Step3 isPending={isPending} onChoose={saveAndGo} />
          )}

          {/* ── Nav bar: Back / Continue (steps 1 + 2) ─────────────────── */}
          {step < 3 && (
            <div
              className="flex items-center justify-between mt-7 pt-5"
              style={{ borderTop: "1px solid var(--zn-line-soft)" }}
            >
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="zn-pill zn-pill-ghost"
                  style={{ height: 34 }}
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}
                className="zn-pill disabled:opacity-40"
                style={{ height: 34 }}
              >
                Continue
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          )}

          {/* ── Back link for step 3 (choices are the primary CTAs) ─────── */}
          {step === 3 && (
            <div
              className="mt-5 pt-4"
              style={{ borderTop: "1px solid var(--zn-line-soft)" }}
            >
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 text-[12.5px] font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--zn-ink-3)" }}
              >
                <ArrowLeft className="size-3" />
                Back
              </button>
            </div>
          )}
        </div>

        {/* ── Skip link ───────────────────────────────────────────────── */}
        <p
          className="mt-5 text-center text-[12px]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Prefer to skip for now?{" "}
          <Link
            href="/dashboard"
            className="underline hover:no-underline"
            style={{ color: "var(--zn-ink-2)" }}
          >
            Go straight to the dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
