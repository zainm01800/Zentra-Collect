"use client";

/**
 * First-run onboarding — Stage 5 audit.
 *
 * Three full-screen steps that gate the first signed-in visit:
 *   1. How do you want to start? (CSV / connect tool / new invoice)
 *   2. Business name + reply-to email (pre-fills new-invoice form forever)
 *   3. Optional: connect outbound email
 *
 * Suppressed by zn:onboarded:v1 in localStorage. Never re-prompts after
 * completion or explicit skip.
 *
 * Renders as a fixed overlay so it sits on top of whatever route the
 * user landed on (typically /today). Skippable at every step.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileUp, Mail, Plug, Plus, X } from "lucide-react";

const ONBOARDED_KEY = "zn:onboarded:v1";

type Path = "csv" | "integration" | "invoice" | null;

export function FirstRunOnboarding() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(1);
  const [path, setPath] = useState<Path>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(ONBOARDED_KEY)) return;
    // Read any existing values so we don't make the user retype them
    setBusinessName(window.localStorage.getItem("zentra.businessName") ?? "");
    setBusinessEmail(window.localStorage.getItem("zentra.businessEmail") ?? "");
    setShow(true);
  }, []);

  function complete(target?: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
      if (businessName) window.localStorage.setItem("zentra.businessName", businessName);
      if (businessEmail) window.localStorage.setItem("zentra.businessEmail", businessEmail);
    }
    setShow(false);
    if (target) router.push(target);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.45)" }}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{ background: "var(--zn-bg)", border: "1px solid var(--zn-line)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
          <div className="flex items-center gap-3">
            <span className="zn-brand-mark" style={{ width: 28, height: 28, fontSize: 14 }}>Z</span>
            <p className="text-[12.5px] font-semibold" style={{ color: "var(--zn-ink-2)" }}>
              Welcome to Zentra Collect — step {step} of 3
            </p>
          </div>
          <button
            type="button"
            onClick={() => complete()}
            aria-label="Skip onboarding"
            className="p-1 rounded hover:bg-black/5"
            style={{ color: "var(--zn-ink-3)" }}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div>
              <h2 className="text-[22px] font-semibold leading-tight" style={{ color: "var(--zn-ink)" }}>
                How do you want to start?
              </h2>
              <p className="mt-2 text-[13.5px] leading-6" style={{ color: "var(--zn-ink-3)" }}>
                Pick the path that matches what&rsquo;s in front of you right now. You can always do the others later.
              </p>

              <div className="mt-5 flex flex-col gap-2.5">
                <PathButton
                  active={path === "csv"}
                  onClick={() => setPath("csv")}
                  icon={<FileUp className="size-4" />}
                  title="Upload an AR ageing CSV"
                  sub="You exported your overdue invoices from Xero / Sage / a spreadsheet."
                />
                <PathButton
                  active={path === "integration"}
                  onClick={() => setPath("integration")}
                  icon={<Plug className="size-4" />}
                  title="Connect Xero, QuickBooks, Sage, or FreeAgent"
                  sub="Read-only sync — we never write back to your books."
                />
                <PathButton
                  active={path === "invoice"}
                  onClick={() => setPath("invoice")}
                  icon={<Plus className="size-4" />}
                  title="Create your first invoice from scratch"
                  sub="No imports — just issue your first invoice in Zentra."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-[22px] font-semibold leading-tight" style={{ color: "var(--zn-ink)" }}>
                Tell us a little about your business.
              </h2>
              <p className="mt-2 text-[13.5px] leading-6" style={{ color: "var(--zn-ink-3)" }}>
                We&rsquo;ll pre-fill these into every invoice and chase email so you don&rsquo;t have to retype them.
              </p>

              <div className="mt-5 space-y-3">
                <Field label="Business name">
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your Business Ltd"
                    className="w-full rounded-lg px-3 py-2.5 text-[14px] border"
                    style={{ borderColor: "var(--zn-line)" }}
                  />
                </Field>
                <Field label="Reply-to email">
                  <input
                    type="email"
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="billing@yourbusiness.co.uk"
                    className="w-full rounded-lg px-3 py-2.5 text-[14px] border"
                    style={{ borderColor: "var(--zn-line)" }}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-[22px] font-semibold leading-tight" style={{ color: "var(--zn-ink)" }}>
                Send chases from your own inbox (optional)
              </h2>
              <p className="mt-2 text-[13.5px] leading-6" style={{ color: "var(--zn-ink-3)" }}>
                Connect SMTP and Zentra-drafted chases land in customers&rsquo; inboxes from <em>your</em> email,
                with replies coming back to you. You can also just copy &amp; paste — skip this and set it up later.
              </p>

              <div className="mt-5 rounded-xl p-4 flex items-start gap-3"
                   style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}>
                <Mail className="size-4 mt-0.5 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                <div className="text-[12.5px] leading-5" style={{ color: "var(--zn-ink-2)" }}>
                  <p className="font-semibold mb-1" style={{ color: "var(--zn-ink)" }}>What you need</p>
                  <p>Your email provider&rsquo;s SMTP host, port, your email, and a password (or app password for Gmail / Outlook).</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t" style={{ borderColor: "var(--zn-line-soft)" }}>
          <button
            type="button"
            onClick={() => complete()}
            className="text-[12.5px] font-medium"
            style={{ color: "var(--zn-ink-3)" }}
          >
            Skip for now
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium"
                style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !path}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
                style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
              >
                Continue <ArrowRight className="size-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => complete(
                  path === "csv" ? "/import"
                  : path === "integration" ? "/settings/integrations"
                  : path === "invoice" ? "/invoices?create=1"
                  : "/today"
                )}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-semibold"
                style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
              >
                <Check className="size-3.5" />
                Finish
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick links for step 3 only — outside the modal so it's optional */}
      {step === 3 && (
        <Link
          href="/settings?tab=email"
          onClick={() => complete()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11.5px] underline z-[201]"
          style={{ color: "var(--zn-bg)" }}
        >
          Configure outbound email now →
        </Link>
      )}
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
        border: `1px solid ${active ? "var(--zn-ink)" : "var(--zn-line-soft)"}`,
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
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium block mb-1.5" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
