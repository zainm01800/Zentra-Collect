"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CreditCard,
  Forward,
  MessageSquare,
  ShieldCheck,
  ArrowLeft,
  Check,
  X,
} from "lucide-react";
import {
  calculateStatutoryInterest,
  isInterestMaterial,
} from "@/lib/statutory-interest";

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

const SAMPLE = {
  invoiceNumber: "INV-2026-0412",
  customerName:  "Northline Creative Ltd",
  amount:        3450.00,
  dueDate:       new Date(Date.now() - 38 * DAY_MS).toISOString().slice(0, 10),
  businessName:  "Acme Studio Ltd",
  businessEmail: "billing@acmestudio.example",
};

type OpenForm = "promise" | "reason" | "forward" | null;

export default function DemoPortalPage() {
  const dueDateMs = new Date(SAMPLE.dueDate).getTime();
  const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDateMs) / DAY_MS));
  const fmtDueDate = new Date(SAMPLE.dueDate).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const showStatutory = isInterestMaterial(SAMPLE.amount, daysOverdue);
  const interestCalc = showStatutory
    ? calculateStatutoryInterest(SAMPLE.amount, daysOverdue)
    : null;

  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [promiseDate, setPromiseDate] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [forwardEmail, setForwardEmail] = useState("");
  const [submitted, setSubmitted] = useState<{ type: OpenForm; value: string } | null>(null);
  const [payClicked, setPayClicked] = useState(false);

  function submitForm(type: OpenForm, value: string) {
    setSubmitted({ type, value });
    setOpenForm(null);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px" }}>

      {/* Demo banner */}
      <div style={{ width: "100%", maxWidth: 448, marginBottom: 16 }}>
        <div style={{
          borderRadius: 10, background: "var(--zn-warn-soft)",
          border: "1px solid var(--zn-warn)", padding: "12px 16px",
        }}>
          <p style={{ fontSize: 12.5, color: "var(--zn-warn)", lineHeight: 1.5, margin: 0 }}>
            <strong>Preview mode</strong> — this is exactly what your end customers see when you send a chase with a payment link. The portal forms are interactive in this preview.
          </p>
          <Link
            href="/demo/chase-plan"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, marginTop: 6, color: "var(--zn-warn)", textDecoration: "underline" }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} /> Back to demo chase plan
          </Link>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 448 }}>

        {/* Creditor branding */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--zn-ink-3)", marginBottom: 4 }}>
            Invoice from
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--zn-ink)", margin: 0 }}>{SAMPLE.businessName}</h1>
        </div>

        {/* Invoice card */}
        <div style={{
          borderRadius: 12, border: "1px solid var(--zn-line-soft)",
          background: "var(--zn-surface)", padding: 20, marginBottom: 16,
        }}>
          <Row label="Invoice"  value={<span style={{ fontFamily: "monospace", fontSize: 13 }}>{SAMPLE.invoiceNumber}</span>} />
          <Row label="Customer" value={SAMPLE.customerName} />
          <Row label="Due" value={
            <span>
              {fmtDueDate}
              <span style={{ marginLeft: 6, color: "var(--zn-risk)", fontWeight: 600 }}>· {daysOverdue}d overdue</span>
            </span>
          } />

          {showStatutory && interestCalc ? (
            <>
              <div style={{ borderTop: "1px solid var(--zn-line-soft)", paddingTop: 12, marginTop: 4 }}>
                <AmtRow label="Invoice amount" value={fmtGBP(SAMPLE.amount)} />
                <AmtRow
                  label={<>+ Statutory interest <span style={{ fontSize: 11, color: "var(--zn-ink-3)" }}>({daysOverdue}d × {interestCalc.annualRate}%)</span></>}
                  value={fmtGBP(interestCalc.interest)}
                />
                <AmtRow label="+ Compensation" value={fmtGBP(interestCalc.compensation)} />
              </div>
              <div style={{ borderTop: "1px solid var(--zn-line-soft)", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--zn-ink)" }}>Total recoverable</span>
                <span style={{ fontSize: 24, fontWeight: 600, color: "var(--zn-ink)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtGBP(interestCalc.totalRecoverable)}
                </span>
              </div>
              <p style={{ fontSize: 10.5, color: "var(--zn-ink-3)", lineHeight: 1.5, marginTop: 8 }}>
                Statutory interest under the UK Late Payment of Commercial Debts (Interest) Act 1998.
              </p>
            </>
          ) : (
            <div style={{ borderTop: "1px solid var(--zn-line-soft)", paddingTop: 12, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--zn-ink)" }}>Amount due</span>
              <span style={{ fontSize: 24, fontWeight: 600, color: "var(--zn-ink)", fontVariantNumeric: "tabular-nums" }}>{fmtGBP(SAMPLE.amount)}</span>
            </div>
          )}
        </div>

        {/* Pay buttons */}
        {payClicked ? (
          <div style={{
            borderRadius: 12, border: "1px solid var(--zn-safe)",
            background: "var(--zn-safe-soft)", padding: "16px 20px",
            marginBottom: 12, textAlign: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--zn-safe)", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              <Check style={{ width: 16, height: 16 }} />
              Payment initiated
            </div>
            <p style={{ fontSize: 12, color: "var(--zn-safe)", margin: 0 }}>
              This is a preview — in production this would open Stripe checkout.
            </p>
          </div>
        ) : showStatutory && interestCalc ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => setPayClicked(true)} style={primaryBtn}>
              <CreditCard style={{ width: 16, height: 16 }} />
              Pay {fmtGBP(interestCalc.totalRecoverable)} (incl. interest)
            </button>
            <button type="button" onClick={() => setPayClicked(true)} style={secondaryBtn}>
              Pay invoice only ({fmtGBP(SAMPLE.amount)})
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setPayClicked(true)} style={{ ...primaryBtn, marginBottom: 12 }}>
            <CreditCard style={{ width: 16, height: 16 }} />
            Pay {fmtGBP(SAMPLE.amount)} now
          </button>
        )}

        {/* Submission confirmation */}
        {submitted && (
          <div style={{
            borderRadius: 12, border: "1px solid var(--zn-safe)",
            background: "var(--zn-safe-soft)", padding: "12px 16px",
            marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <Check style={{ width: 16, height: 16, color: "var(--zn-safe)", marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              {submitted.type === "promise" && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--zn-safe)", margin: 0 }}>Payment date logged</p>
                  <p style={{ fontSize: 12, color: "var(--zn-safe)", marginTop: 4 }}>
                    Thank you — we have noted your payment date of{" "}
                    <strong>
                      {new Date(submitted.value).toLocaleDateString("en-GB", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </strong>. We will follow up if payment is not received by then.
                  </p>
                </>
              )}
              {submitted.type === "reason" && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--zn-safe)", margin: 0 }}>Message received</p>
                  <p style={{ fontSize: 12, color: "var(--zn-safe)", marginTop: 4 }}>
                    Thank you for letting us know. {SAMPLE.businessName} will review your note and be in touch shortly.
                  </p>
                </>
              )}
              {submitted.type === "forward" && (
                <>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--zn-safe)", margin: 0 }}>Forwarded to AP team</p>
                  <p style={{ fontSize: 12, color: "var(--zn-safe)", marginTop: 4 }}>
                    A copy of this invoice has been sent to <strong>{submitted.value}</strong>.
                  </p>
                </>
              )}
            </div>
            <button type="button" onClick={() => setSubmitted(null)} style={{ color: "var(--zn-safe)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
        )}

        {/* Secondary action buttons */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
          {(["promise", "reason", "forward"] as const).map((form) => {
            const Icon = form === "promise" ? Calendar : form === "reason" ? MessageSquare : Forward;
            const label = form === "promise" ? "Promise date" : form === "reason" ? "Tell us why" : "Forward to AP";
            const done = submitted?.type === form;
            const active = openForm === form;
            return (
              <button
                key={form}
                type="button"
                onClick={() => setOpenForm(openForm === form ? null : form)}
                style={{
                  display: "inline-flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: 4, borderRadius: 8,
                  padding: "10px 8px", fontSize: 11.5, fontWeight: 500,
                  textAlign: "center", cursor: "pointer", transition: "opacity 0.15s",
                  background: done ? "var(--zn-safe-soft)" : active ? "var(--zn-bg-inverse)" : "transparent",
                  color:      done ? "var(--zn-safe)"     : active ? "#fff"                  : "var(--zn-ink)",
                  border: `1px solid ${done ? "var(--zn-safe)" : active ? "var(--zn-bg-inverse)" : "var(--zn-line-soft)"}`,
                }}
              >
                {done ? <Check style={{ width: 14, height: 14 }} /> : <Icon style={{ width: 14, height: 14 }} />}
                {done && form === "promise" ? "Date set" : done ? "Sent" : label}
              </button>
            );
          })}
        </div>

        {/* Inline forms */}
        {openForm === "promise" && (
          <InlineForm title="When do you expect to pay?" subtitle="We'll pause automated reminders until this date and follow up if payment hasn't arrived.">
            <input
              type="date" min={today} value={promiseDate}
              onChange={(e) => setPromiseDate(e.target.value)}
              style={inputStyle}
            />
            <FormActions
              onSubmit={() => submitForm("promise", promiseDate)}
              onCancel={() => setOpenForm(null)}
              disabled={!promiseDate}
              submitLabel="Confirm date"
            />
          </InlineForm>
        )}

        {openForm === "reason" && (
          <InlineForm title="What's holding up payment?" subtitle={`Let ${SAMPLE.businessName} know — disputes, missing PO numbers, or cash-flow issues are all fine to mention.`}>
            <textarea
              rows={4}
              placeholder="e.g. Awaiting PO approval from our finance team — expecting sign-off by end of week."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              style={{ ...inputStyle, resize: "none" }}
            />
            <FormActions
              onSubmit={() => submitForm("reason", reasonText.trim())}
              onCancel={() => setOpenForm(null)}
              disabled={!reasonText.trim()}
              submitLabel="Send message"
            />
          </InlineForm>
        )}

        {openForm === "forward" && (
          <InlineForm title="Forward to your AP team" subtitle="Enter your accounts payable email — we'll send them this invoice directly.">
            <input
              type="email"
              placeholder="ap@yourcompany.com"
              value={forwardEmail}
              onChange={(e) => setForwardEmail(e.target.value)}
              style={inputStyle}
            />
            <FormActions
              onSubmit={() => submitForm("forward", forwardEmail)}
              onCancel={() => setOpenForm(null)}
              disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardEmail)}
              submitLabel="Forward invoice"
            />
          </InlineForm>
        )}

        {/* Trust footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 11.5, color: "var(--zn-ink-3)" }}>
          <ShieldCheck style={{ width: 12, height: 12 }} />
          Secure payment via Stripe · Card / Apple Pay / Google Pay
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "var(--zn-ink-3)", marginTop: 12 }}>
          Questions? Email{" "}
          <a href={`mailto:${SAMPLE.businessEmail}`} style={{ color: "var(--zn-ink-3)" }}>
            {SAMPLE.businessEmail}
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: "var(--zn-ink-3)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--zn-ink)" }}>{value}</span>
    </div>
  );
}

function AmtRow({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: "var(--zn-ink-3)" }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--zn-ink)" }}>{value}</span>
    </div>
  );
}

function InlineForm({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 12, border: "1px solid var(--zn-line-soft)",
      background: "var(--zn-surface)", padding: 16, marginBottom: 16,
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--zn-ink)", margin: "0 0 4px" }}>{title}</p>
      <p style={{ fontSize: 11.5, color: "var(--zn-ink-3)", margin: "0 0 12px" }}>{subtitle}</p>
      {children}
    </div>
  );
}

function FormActions({ onSubmit, onCancel, disabled, submitLabel }: {
  onSubmit: () => void; onCancel: () => void; disabled: boolean; submitLabel: string;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button" disabled={disabled} onClick={onSubmit}
        style={{ flex: 1, borderRadius: 999, background: "var(--zn-bg-inverse)", color: "#fff", border: "none", padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}
      >
        {submitLabel}
      </button>
      <button
        type="button" onClick={onCancel}
        style={{ borderRadius: 999, border: "1px solid var(--zn-line-soft)", background: "transparent", color: "var(--zn-ink)", padding: "8px 16px", fontSize: 13, cursor: "pointer" }}
      >
        Cancel
      </button>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: 8, borderRadius: 999, background: "var(--zn-bg-inverse)", color: "#fff",
  border: "none", padding: "12px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center",
  gap: 8, borderRadius: 999, border: "1px solid var(--zn-line-soft)",
  background: "transparent", color: "var(--zn-ink)",
  padding: "12px 20px", fontSize: 13.5, fontWeight: 500, cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%", borderRadius: 8, border: "1px solid var(--zn-line-soft)",
  background: "var(--zn-surface-2)", color: "var(--zn-ink)",
  padding: "8px 12px", fontSize: 13, marginBottom: 12,
  outline: "none", boxSizing: "border-box",
};
