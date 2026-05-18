"use client";

/**
 * First-run workspace setup gate — Option B.
 *
 * A two-step blocking overlay shown to every new user before they can
 * access any feature. Steps:
 *   1. Business name (required — gate cannot be bypassed without it)
 *   2. How do you want to start? (CSV / connect tool / new invoice)
 *
 * On completion the user is routed to the appropriate entry point.
 * Suppressed once zn:workspace:v1 OR the legacy zn:onboarded:v1 key is set.
 *
 * Renders as a fixed overlay on top of the current route.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileUp, Plug, Plus } from "lucide-react";
import { saveOnboardingBusinessNameAction } from "@/actions/account";

const WORKSPACE_KEY = "zn:workspace:v1";
const LEGACY_KEY    = "zn:onboarded:v1";

type StartPath = "csv" | "integration" | "invoice" | null;

export function FirstRunOnboarding() {
  const router = useRouter();
  const [show, setShow]                 = useState(false);
  const [step, setStep]                 = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [startPath, setStartPath]       = useState<StartPath>(null);
  const [nameError, setNameError]       = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Already completed (new key or legacy key)
    if (
      window.localStorage.getItem(WORKSPACE_KEY) ||
      window.localStorage.getItem(LEGACY_KEY)
    ) return;
    // Pre-fill if they had started before
    setBusinessName(window.localStorage.getItem("zentra.businessName") ?? "");
    setShow(true);
  }, []);

  async function advanceToStep2() {
    if (!businessName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const trimmed = businessName.trim();
    window.localStorage.setItem("zentra.businessName", trimmed);
    // CB-6: persist to DB so Settings + chase emails see the name immediately.
    // Fire-and-forget — the modal proceeds even if the network is slow; the
    // localStorage value still pre-fills the Settings form on next visit.
    void saveOnboardingBusinessNameAction(trimmed).catch(() => undefined);
    setStep(2);
  }

  function complete() {
    window.localStorage.setItem(WORKSPACE_KEY, "1");
    // Keep businessName persisted (already set in advanceToStep2)
    setShow(false);

    const destination =
      startPath === "csv"         ? "/import"
      : startPath === "integration" ? "/settings/integrations"
      : startPath === "invoice"     ? "/invoices?create=1"
      : "/today";
    router.push(destination);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ background: "var(--zn-bg)", border: "1px solid var(--zn-line)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-5 border-b"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          <span className="zn-brand-mark" style={{ width: 28, height: 28, fontSize: 14 }}>Z</span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Welcome to Zentra Collect
            </p>
            <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
              Step {step} of 2 — takes about 30 seconds
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-6 py-6">

          {/* ── Step 1: Business name ────────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <h2
                className="text-[22px] font-semibold leading-tight"
                style={{ color: "var(--zn-ink)" }}
              >
                What&rsquo;s your business name?
              </h2>
              <p className="mt-2 text-[13.5px] leading-6" style={{ color: "var(--zn-ink-3)" }}>
                We&rsquo;ll pre-fill this into every invoice and chase email so you
                don&rsquo;t have to retype it.
              </p>

              <div className="mt-5">
                <label className="block">
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5"
                    style={{ color: "var(--zn-ink-3)" }}
                  >
                    Business name
                  </span>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      if (e.target.value.trim()) setNameError(false);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") advanceToStep2(); }}
                    placeholder="Your Business Ltd"
                    autoFocus
                    className="w-full rounded-xl px-4 py-3 text-[15px] border"
                    style={{
                      borderColor: nameError ? "var(--zn-risk)" : "var(--zn-line)",
                      background:  "var(--zn-surface)",
                      color:       "var(--zn-ink)",
                    }}
                  />
                </label>
                {nameError && (
                  <p className="mt-1.5 text-[12px]" style={{ color: "var(--zn-risk)" }}>
                    Please enter your business name to continue.
                  </p>
                )}
              </div>

              <p className="mt-4 text-[11.5px] leading-5" style={{ color: "var(--zn-ink-3)" }}>
                You can update this any time in Settings.
              </p>
            </div>
          )}

          {/* ── Step 2: How do you want to start? ────────────────────────────── */}
          {step === 2 && (
            <div>
              <h2
                className="text-[22px] font-semibold leading-tight"
                style={{ color: "var(--zn-ink)" }}
              >
                How do you want to start?
              </h2>
              <p className="mt-2 text-[13.5px] leading-6" style={{ color: "var(--zn-ink-3)" }}>
                Pick the path that matches what&rsquo;s in front of you. You can do
                the others any time from Settings.
              </p>

              <div className="mt-5 flex flex-col gap-2.5">
                <PathButton
                  active={startPath === "csv"}
                  onClick={() => setStartPath("csv")}
                  icon={<FileUp className="size-4" />}
                  title="Upload an AR ageing CSV"
                  sub="Exported from Xero, Sage, QuickBooks, or a spreadsheet."
                />
                <PathButton
                  active={startPath === "integration"}
                  onClick={() => setStartPath("integration")}
                  icon={<Plug className="size-4" />}
                  title="Connect Xero, QuickBooks, Sage, or FreeAgent"
                  sub="Read-only sync — we never write back to your books."
                />
                <PathButton
                  active={startPath === "invoice"}
                  onClick={() => setStartPath("invoice")}
                  icon={<Plus className="size-4" />}
                  title="Create your first invoice from scratch"
                  sub="No imports — just issue your first invoice in Zentra."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4 border-t"
          style={{ borderColor: "var(--zn-line-soft)" }}
        >
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-[12.5px] font-medium"
              style={{ color: "var(--zn-ink-3)" }}
            >
              ← Back
            </button>
          ) : (
            <span /> /* empty placeholder to keep flex layout */
          )}

          <div className="flex items-center gap-2">
            {step === 1 ? (
              <button
                type="button"
                onClick={advanceToStep2}
                className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold"
                style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
              >
                Continue <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={complete}
                  className="text-[12px] font-medium"
                  style={{ color: "var(--zn-ink-3)" }}
                >
                  Skip — go to dashboard
                </button>
                <button
                  type="button"
                  onClick={complete}
                  disabled={!startPath}
                  className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold disabled:opacity-40"
                  style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
                >
                  <Check className="size-3.5" />
                  {startPath === "csv"         ? "Go to import"
                   : startPath === "integration" ? "Go to integrations"
                   : startPath === "invoice"     ? "Create invoice"
                   : "Let's go"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PathButton({
  active, onClick, icon, title, sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-xl px-4 py-3 text-left transition-colors"
      style={{
        background: active ? "var(--zn-surface-2)" : "var(--zn-surface)",
        border:     `1px solid ${active ? "var(--zn-ink)" : "var(--zn-line-soft)"}`,
      }}
    >
      <div
        className="size-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "var(--zn-bg-2)", color: "var(--zn-ink-2)" }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
          {title}
        </p>
        <p className="mt-0.5 text-[12px] leading-4" style={{ color: "var(--zn-ink-3)" }}>
          {sub}
        </p>
      </div>
      {active && (
        <div
          className="size-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "var(--zn-ink)" }}
        >
          <Check className="size-2.5 text-white" />
        </div>
      )}
    </button>
  );
}
