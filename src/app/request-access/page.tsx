"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock, Users } from "lucide-react";
import type {
  AccountingSoftware,
  ArPain,
  WouldPay,
} from "@/lib/beta/store";

// ── Static option lists ───────────────────────────────────────────────────────

const ACCOUNTING_SOFTWARE: AccountingSoftware[] = [
  "Xero",
  "QuickBooks",
  "FreeAgent",
  "Sage",
  "Stripe",
  "Excel / other",
];

const AR_PAINS: ArPain[] = [
  "Overdue invoices",
  "Missed promises",
  "Disputes",
  "Remittance matching",
  "Statement requests",
  "Messy client files",
  "Not enough time",
];

const INVOICES_PER_MONTH = [
  "Under 20",
  "20–50",
  "50–150",
  "150–500",
  "500+",
];

const CLIENT_LEDGERS = [
  "Just my own business",
  "2–5 clients",
  "6–10 clients",
  "11–25 clients",
  "26–50 clients",
  "50+ clients",
];

// ── Form state ────────────────────────────────────────────────────────────────

type FormState = {
  name: string;
  email: string;
  businessName: string;
  isBookkeeper: boolean | null;
  clientLedgersManaged: string;
  accountingSoftware: AccountingSoftware[];
  approximateInvoicesPerMonth: string;
  biggestArPain: ArPain[];
  wouldUploadSampleFile: boolean | null;
  wouldPayFoundingPricing: WouldPay | null;
  message: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  businessName: "",
  isBookkeeper: null,
  clientLedgersManaged: "",
  accountingSoftware: [],
  approximateInvoicesPerMonth: "",
  biggestArPain: [],
  wouldUploadSampleFile: null,
  wouldPayFoundingPricing: null,
  message: "",
};

// ── Small UI primitives ───────────────────────────────────────────────────────

function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <p className="mb-2 text-sm font-medium text-neutral-800">
      {children}
      {required && <span className="ml-1 text-red-500">*</span>}
    </p>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-neutral-400">{children}</p>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
    />
  );
}

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
            value === opt.value
              ? "border-neutral-950 bg-neutral-950 text-white"
              : "border-black/12 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CheckboxGroup<T extends string>({
  options,
  selected,
  onChange,
}: {
  options: T[];
  selected: T[];
  onChange: (selected: T[]) => void;
}) {
  function toggle(option: T) {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const checked = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors ${
              checked
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-black/12 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
            }`}
          >
            {checked && (
              <CheckCircle2 className="size-3.5 shrink-0" />
            )}
            {option}
          </button>
        );
      })}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-neutral-950 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-black/8" />
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-neutral-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-black/8" />
    </div>
  );
}

// ── Confirmation screen ───────────────────────────────────────────────────────

function ConfirmationScreen() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-neutral-950">
        <CheckCircle2 className="size-8 text-white" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold text-neutral-950">
        Request received
      </h2>
      <p className="mt-3 max-w-md text-base leading-7 text-neutral-500">
        Thanks — we&rsquo;ll review your request and contact you about early
        access. Founding spaces are limited, and we&rsquo;ll prioritise users
        whose workflow matches what Zentra Collect is built for.
      </p>
      <p className="mt-4 text-sm text-neutral-400">
        No automatic access has been granted. You&rsquo;ll hear from us by
        email within a few days.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Try the demo
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-black/15 bg-white px-6 py-2.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-50"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RequestAccessPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(update: Partial<FormState>) {
    setForm((current) => ({ ...current, ...update }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side required field check
    if (!form.name.trim()) return setError("Please enter your name.");
    if (!form.email.trim()) return setError("Please enter your email.");
    if (!form.businessName.trim()) return setError("Please enter your business name.");
    if (form.isBookkeeper === null) return setError("Please answer the bookkeeper question.");

    setSubmitting(true);

    try {
      const res = await fetch("/api/beta/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // Normalise null booleans to sensible defaults for the API
          wouldUploadSampleFile: form.wouldUploadSampleFile ?? false,
          wouldPayFoundingPricing: form.wouldPayFoundingPricing ?? "maybe",
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fbf8f1] text-neutral-950">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#fbf8f1]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-950 text-base font-bold text-white">
              Z
            </span>
            <span className="leading-tight">
              <span className="block tracking-[0.18em]">ZENTRA</span>
              <span className="block text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Collect
              </span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950"
          >
            Try the demo
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">

        {submitted ? (
          <ConfirmationScreen />
        ) : (
          <>
            {/* ── Founding badge ──────────────────────────────────────────── */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800">
              <Users className="size-3.5" />
              Founding access — limited spaces
            </div>

            {/* ── Heading ─────────────────────────────────────────────────── */}
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">
              Request founding access
            </h1>
            <p className="mt-4 text-base leading-7 text-neutral-500">
              Zentra Collect is in private beta. We&rsquo;re onboarding a small
              group of bookkeepers and service businesses to help us sharpen the
              product before we open more widely. Fill in the form and we&rsquo;ll
              be in touch.
            </p>

            {/* ── Honest product note ─────────────────────────────────────── */}
            <div className="mt-6 flex gap-3 rounded-2xl border border-black/8 bg-white/70 p-4">
              <Lock className="mt-0.5 size-4 shrink-0 text-neutral-400" />
              <p className="text-sm leading-6 text-neutral-500">
                <span className="font-medium text-neutral-700">This is beta software.</span>{" "}
                The product currently works with CSV exports from most UK
                accounting tools. All draft messages require your review before
                sending — nothing is sent automatically. Founding access is
                granted individually, not automatically on form submission.
              </p>
            </div>

            {/* ── Form ────────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-8">

              <SectionDivider label="About you" />

              <div className="space-y-5">
                <div>
                  <Label required>Your name</Label>
                  <TextInput
                    value={form.name}
                    onChange={(v) => patch({ name: v })}
                    placeholder="Jane Smith"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <Label required>Work email</Label>
                  <TextInput
                    value={form.email}
                    onChange={(v) => patch({ email: v })}
                    placeholder="jane@yourbusiness.co.uk"
                    type="email"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <Label required>Business name</Label>
                  <TextInput
                    value={form.businessName}
                    onChange={(v) => patch({ businessName: v })}
                    placeholder="Smith Bookkeeping Ltd"
                    autoComplete="organization"
                  />
                </div>
              </div>

              <SectionDivider label="Your setup" />

              <div className="space-y-6">
                <div>
                  <Label required>Are you a bookkeeper or accountant?</Label>
                  <FieldHint>
                    This helps us understand whether you manage one business or many.
                  </FieldHint>
                  <div className="mt-2">
                    <RadioGroup
                      options={[
                        { label: "Yes", value: "yes" },
                        { label: "No — I manage my own invoices", value: "no" },
                      ]}
                      value={
                        form.isBookkeeper === null
                          ? null
                          : form.isBookkeeper
                          ? "yes"
                          : "no"
                      }
                      onChange={(v) => patch({ isBookkeeper: v === "yes" })}
                    />
                  </div>
                </div>

                {form.isBookkeeper && (
                  <div>
                    <Label>How many client ledgers do you manage?</Label>
                    <div className="mt-2">
                      <SelectInput
                        value={form.clientLedgersManaged}
                        onChange={(v) => patch({ clientLedgersManaged: v })}
                        options={CLIENT_LEDGERS}
                        placeholder="Select a range…"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label>Accounting software used</Label>
                  <FieldHint>Select all that apply.</FieldHint>
                  <div className="mt-2">
                    <CheckboxGroup
                      options={ACCOUNTING_SOFTWARE}
                      selected={form.accountingSoftware}
                      onChange={(selected) =>
                        patch({ accountingSoftware: selected as AccountingSoftware[] })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Approximate invoices per month</Label>
                  <FieldHint>
                    Across all your clients if you&rsquo;re a bookkeeper.
                  </FieldHint>
                  <div className="mt-2">
                    <SelectInput
                      value={form.approximateInvoicesPerMonth}
                      onChange={(v) => patch({ approximateInvoicesPerMonth: v })}
                      options={INVOICES_PER_MONTH}
                      placeholder="Select a range…"
                    />
                  </div>
                </div>
              </div>

              <SectionDivider label="Your AR workflow" />

              <div className="space-y-6">
                <div>
                  <Label>Biggest AR pain right now</Label>
                  <FieldHint>Select everything that applies.</FieldHint>
                  <div className="mt-2">
                    <CheckboxGroup
                      options={AR_PAINS}
                      selected={form.biggestArPain}
                      onChange={(selected) =>
                        patch({ biggestArPain: selected as ArPain[] })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>
                    Would you upload a sample AR ageing file for us to review?
                  </Label>
                  <FieldHint>
                    We might ask to see a real (or anonymised) export to check
                    our column mapping works for your software. No obligation.
                  </FieldHint>
                  <div className="mt-2">
                    <RadioGroup
                      options={[
                        { label: "Yes", value: "yes" },
                        { label: "No", value: "no" },
                      ]}
                      value={
                        form.wouldUploadSampleFile === null
                          ? null
                          : form.wouldUploadSampleFile
                          ? "yes"
                          : "no"
                      }
                      onChange={(v) =>
                        patch({ wouldUploadSampleFile: v === "yes" })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>
                    If Zentra Collect solves this for you, would you pay founding pricing?
                  </Label>
                  <FieldHint>
                    Founding pricing will be lower than published rates and locked
                    in for the first year. No payment is taken now.
                  </FieldHint>
                  <div className="mt-2">
                    <RadioGroup
                      options={[
                        { label: "Yes", value: "yes" },
                        { label: "Maybe", value: "maybe" },
                        { label: "No", value: "no" },
                      ]}
                      value={form.wouldPayFoundingPricing}
                      onChange={(v) =>
                        patch({ wouldPayFoundingPricing: v as WouldPay })
                      }
                    />
                  </div>
                </div>
              </div>

              <SectionDivider label="Anything else" />

              <div>
                <Label>Optional — anything you&apos;d like us to know</Label>
                <FieldHint>
                  Specific software quirks, workflows we should understand, or
                  questions about what the product does and doesn&rsquo;t do yet.
                </FieldHint>
                <textarea
                  value={form.message}
                  onChange={(e) => patch({ message: e.target.value })}
                  rows={4}
                  placeholder="e.g. We use Xero but export to Excel before chasing. Most of our pain is around clients who promise but don't pay…"
                  className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                />
              </div>

              {/* ── Error ──────────────────────────────────────────────────── */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* ── Submit ─────────────────────────────────────────────────── */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-950 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Request founding access"}
                  {!submitting && <ArrowRight className="size-4" />}
                </button>
                <p className="mt-3 text-center text-xs text-neutral-400">
                  We&rsquo;ll review your request and contact you by email.
                  No access is granted automatically. No payment is taken now.
                </p>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
