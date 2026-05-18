"use client";

/**
 * Inbound Email Settings
 *
 * Lets the user set up automatic debtor reply classification.
 * Two options:
 *   A — Gmail App Password (IMAP polling every 5 min, no Zentra address visible)
 *   B — Forward-to-classify (unique Zentra inbound address, user sets Gmail filter)
 *
 * Shows clearly what each option requires and what it does.
 */

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Mail,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";

type Tab = "imap" | "forward";

interface Settings {
  configured: boolean;
  forwardAddress: string | null;
  forwardEnabled: boolean;
  imapEnabled: boolean;
  imapEmail: string | null;
  imapLastPolledAt: string | null;
}

export function InboundEmailSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("imap");

  // IMAP form state
  const [imapEmail, setImapEmail] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapSaving, setImapSaving] = useState(false);
  const [imapError, setImapError] = useState<string | null>(null);
  const [imapSuccess, setImapSuccess] = useState(false);

  // Forward form state
  const [forwardSaving, setForwardSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/email/inbound-settings")
      .then((r) => r.json())
      .then((d) => { setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function saveImap() {
    if (!imapEmail.trim() || !imapPassword.trim()) return;
    setImapSaving(true);
    setImapError(null);
    setImapSuccess(false);
    try {
      const res = await fetch("/api/email/inbound-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "imap", imapEmail: imapEmail.trim(), imapPassword: imapPassword.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to save.");
      setImapSuccess(true);
      setImapPassword("");
      setSettings((s) => s ? { ...s, imapEnabled: true, imapEmail: imapEmail.trim(), configured: true } : s);
    } catch (err) {
      setImapError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setImapSaving(false);
    }
  }

  async function enableForward() {
    setForwardSaving(true);
    try {
      await fetch("/api/email/inbound-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "forward" }),
      });
      // Reload to get the generated forward address
      const res = await fetch("/api/email/inbound-settings");
      const data = await res.json();
      setSettings(data);
    } finally {
      setForwardSaving(false);
    }
  }

  async function disable(method: "imap" | "forward") {
    await fetch("/api/email/inbound-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: method === "imap" ? "disable_imap" : "disable_forward" }),
    });
    setSettings((s) => s
      ? { ...s, imapEnabled: method === "imap" ? false : s.imapEnabled, forwardEnabled: method === "forward" ? false : s.forwardEnabled }
      : s
    );
  }

  function copyAddress() {
    if (!settings?.forwardAddress) return;
    navigator.clipboard.writeText(settings.forwardAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl h-40" style={{ background: "var(--zn-surface-2)" }} />
    );
  }

  return (
    <div className="flex flex-col gap-0 rounded-xl overflow-hidden" style={{ border: "1px solid var(--zn-line)" }}>

      {/* Header */}
      <div className="px-5 py-4" style={{ background: "var(--zn-surface-2)", borderBottom: "1px solid var(--zn-line-soft)" }}>
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--zn-surface)" }}>
            <Mail className="size-4" style={{ color: "var(--zn-ink-2)" }} />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Automatic reply classification
            </p>
            <p className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: "var(--zn-ink-3)" }}>
              When a debtor replies to a chase email, Zentra reads the reply and classifies it — promise to pay, dispute, stall, or document request — then surfaces the recommended next action on your chase plan. Choose how replies reach Zentra.
            </p>
          </div>
        </div>
      </div>

      {/* Option tabs */}
      <div className="flex border-b" style={{ borderColor: "var(--zn-line-soft)" }}>
        {([
          { id: "imap" as Tab, label: "Gmail App Password", badge: settings?.imapEnabled ? "Active" : null },
          { id: "forward" as Tab, label: "Forward-to-classify", badge: settings?.forwardEnabled ? "Active" : null },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-5 py-3 text-[13px] font-medium border-b-2 transition-colors"
            style={{
              borderColor: activeTab === tab.id ? "var(--zn-ink)" : "transparent",
              color: activeTab === tab.id ? "var(--zn-ink)" : "var(--zn-ink-3)",
              background: "transparent",
            }}
          >
            {tab.label}
            {tab.badge && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Option A: IMAP / App Password ─────────────────────────────────── */}
      {activeTab === "imap" && (
        <div className="px-5 py-5 flex flex-col gap-5">

          {/* What this is */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <FeaturePill icon={Zap}    text="Replies classified within 5 minutes" />
              <FeaturePill icon={Shield} text="No Zentra address — debtors see your email only" />
              <FeaturePill icon={Mail}   text="Works with Gmail and Outlook" />
            </div>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--zn-ink-3)" }}>
              Zentra polls your inbox every 5 minutes using read-only access. When a reply arrives from a known debtor, it is classified automatically and appears on your chase plan. Debtors always see your own email address — Zentra is invisible to them.
            </p>
          </div>

          {/* How to get an App Password */}
          <details className="group">
            <summary
              className="flex items-center justify-between cursor-pointer list-none rounded-lg px-4 py-3 text-[13px] font-medium"
              style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}
            >
              How to create a Gmail App Password
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" style={{ color: "var(--zn-ink-3)" }} />
            </summary>
            <div className="mt-2 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed flex flex-col gap-2" style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}>
              <p><strong>1.</strong> Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline">myaccount.google.com/security</a></p>
              <p><strong>2.</strong> Under "How you sign in to Google", click <strong>2-Step Verification</strong> (must be enabled)</p>
              <p><strong>3.</strong> Scroll to the bottom and click <strong>App passwords</strong></p>
              <p><strong>4.</strong> Enter a name like "Zentra Collect" and click <strong>Create</strong></p>
              <p><strong>5.</strong> Copy the 16-character password shown and paste it below</p>
              <div className="flex items-center gap-1.5 mt-1 rounded-md px-3 py-2" style={{ background: "var(--zn-warn-soft)" }}>
                <span className="text-[11px]" style={{ color: "var(--zn-ink-2)" }}>
                  <strong>Outlook users:</strong> Use your regular password — Outlook supports standard IMAP login. If your org uses modern auth only, use the Forward option instead.
                </span>
              </div>
            </div>
          </details>

          {/* Active state */}
          {settings?.imapEnabled ? (
            <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)44" }}>
              <div className="flex items-center gap-2.5">
                <Check className="size-4 shrink-0" style={{ color: "var(--zn-safe)" }} />
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                    Connected — {settings.imapEmail}
                  </p>
                  {settings.imapLastPolledAt && (
                    <p className="text-[11.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                      Last polled: {new Date(settings.imapLastPolledAt).toLocaleString("en-GB")}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => disable("imap")}
                className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                style={{ color: "var(--zn-risk)", background: "var(--zn-risk-soft)" }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            /* Setup form */
            <div className="flex flex-col gap-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                    Gmail / Outlook address
                  </label>
                  <input
                    type="email"
                    value={imapEmail}
                    onChange={(e) => setImapEmail(e.target.value)}
                    placeholder="you@gmail.com"
                    className="rounded-[8px] border px-3 py-2 text-[13px] outline-none"
                    style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                    App Password (16 characters)
                  </label>
                  <input
                    type="password"
                    value={imapPassword}
                    onChange={(e) => setImapPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="rounded-[8px] border px-3 py-2 text-[13px] outline-none font-mono"
                    style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                  />
                </div>
              </div>

              {imapError && (
                <p className="text-[12.5px] px-3 py-2 rounded-lg" style={{ background: "var(--zn-risk-soft)", color: "var(--zn-risk)" }}>
                  {imapError}
                </p>
              )}
              {imapSuccess && (
                <p className="text-[12.5px] px-3 py-2 rounded-lg" style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}>
                  Connected. Zentra will start classifying replies within 5 minutes.
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
                  Password is encrypted with AES-256 before storage. Zentra only reads — never sends or deletes.
                </p>
                <button
                  type="button"
                  onClick={saveImap}
                  disabled={!imapEmail.trim() || !imapPassword.trim() || imapSaving}
                  className="zn-pill shrink-0"
                  style={{ opacity: (!imapEmail.trim() || !imapPassword.trim() || imapSaving) ? 0.5 : 1 }}
                >
                  {imapSaving ? <><RefreshCw className="size-3.5 animate-spin" /> Connecting…</> : "Connect inbox"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Option B: Forward-to-classify ──────────────────────────────────── */}
      {activeTab === "forward" && (
        <div className="px-5 py-5 flex flex-col gap-5">

          {/* What this is */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <FeaturePill icon={Shield} text="No inbox access required" />
              <FeaturePill icon={Mail}   text="Works with any email provider" />
              <FeaturePill icon={Zap}    text="Classified within seconds of forwarding" />
            </div>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--zn-ink-3)" }}>
              Zentra gives you a unique email address. When you receive a debtor reply, either forward it manually or set up a Gmail filter to forward automatically. Zentra classifies it and surfaces the result on your chase plan. No inbox access needed — you stay in full control.
            </p>
          </div>

          {/* Step-by-step */}
          {!settings?.forwardEnabled ? (
            <div className="flex flex-col gap-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--zn-ink-3)" }}>
                How it works
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { n: "1", text: "Click Enable below — Zentra generates your unique inbound address." },
                  { n: "2", text: "Copy the address and set up a Gmail filter: any email from debtor domains forwards there automatically." },
                  { n: "3", text: "Or simply forward individual replies manually whenever you want one classified." },
                  { n: "4", text: "Classified replies appear on your chase plan within seconds." },
                ].map((step) => (
                  <div key={step.n} className="flex items-start gap-3">
                    <span
                      className="size-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5"
                      style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}
                    >
                      {step.n}
                    </span>
                    <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg px-3 py-2.5 text-[12px] leading-relaxed" style={{ background: "var(--zn-warn-soft)", color: "var(--zn-ink-2)" }}>
                <strong>Requires DNS setup.</strong> To receive emails at <code>@in.zentracollect.co.uk</code>, an MX record must point to Resend or Postmark. If you are self-hosting, contact your admin. If you are using Zentra Cloud, this is already configured.
              </div>

              <button
                type="button"
                onClick={enableForward}
                disabled={forwardSaving}
                className="zn-pill self-start"
              >
                {forwardSaving ? <><RefreshCw className="size-3.5 animate-spin" /> Enabling…</> : "Enable forward-to-classify"}
              </button>
            </div>
          ) : (
            /* Active — show the address and filter instructions */
            <div className="flex flex-col gap-4">
              <div
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)44" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Check className="size-4 shrink-0" style={{ color: "var(--zn-safe)" }} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>Active</p>
                    <p className="text-[11.5px] mt-0.5 font-mono truncate" style={{ color: "var(--zn-ink-3)" }}>
                      {settings.forwardAddress}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: "var(--zn-surface)", color: "var(--zn-ink-2)", border: "1px solid var(--zn-line)" }}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => disable("forward")}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ color: "var(--zn-risk)", background: "var(--zn-risk-soft)" }}
                  >
                    Disable
                  </button>
                </div>
              </div>

              {/* Gmail filter instructions */}
              <details className="group">
                <summary
                  className="flex items-center justify-between cursor-pointer list-none rounded-lg px-4 py-3 text-[13px] font-medium"
                  style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}
                >
                  Set up automatic forwarding in Gmail
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" style={{ color: "var(--zn-ink-3)" }} />
                </summary>
                <div className="mt-2 px-4 py-3 rounded-lg text-[12.5px] leading-relaxed flex flex-col gap-2.5" style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}>
                  <p><strong>1.</strong> In Gmail, click Settings (⚙️) → <strong>See all settings</strong></p>
                  <p><strong>2.</strong> Go to the <strong>Filters and Blocked Addresses</strong> tab</p>
                  <p><strong>3.</strong> Click <strong>Create a new filter</strong></p>
                  <p><strong>4.</strong> In the <em>From</em> field enter your debtor's email domain (e.g. <code>@acmeltd.co.uk</code>) — or leave it blank to forward all replies</p>
                  <p><strong>5.</strong> Click <strong>Create filter</strong>, then tick <strong>Forward it to</strong> and paste your Zentra address</p>
                  <p><strong>6.</strong> Click <strong>Create filter</strong> to save</p>
                  <p className="text-[11.5px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
                    Gmail will ask you to confirm the forwarding address the first time — check your Zentra inbox for the confirmation email.
                  </p>
                  <a
                    href="https://support.google.com/mail/answer/6579"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] underline"
                    style={{ color: "var(--zn-ink-3)" }}
                  >
                    Gmail forwarding guide <ExternalLink className="size-3" />
                  </a>
                </div>
              </details>

              <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
                You can also forward individual emails manually at any time — just forward any reply to your Zentra address and it will be classified within seconds.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Comparison footer */}
      <div
        className="px-5 py-3.5 border-t flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between"
        style={{ borderColor: "var(--zn-line-soft)", background: "var(--zn-bg-2)" }}
      >
        <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
          You can enable both options at the same time. App Password is best for automatic coverage; Forward-to-classify is best if you prefer no inbox access.
        </p>
        <a
          href="/chase-today"
          className="inline-flex items-center gap-1 text-[12px] font-medium whitespace-nowrap shrink-0"
          style={{ color: "var(--zn-ink-2)" }}
        >
          View classified replies <ChevronRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}

function FeaturePill({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium"
      style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)", border: "1px solid var(--zn-line-soft)" }}
    >
      <Icon className="size-3 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
      {text}
    </div>
  );
}
