/**
 * Stop-chasing intelligence.
 *
 * Most collections tools only ever tell you to chase *more*. This module
 * tells you when *not* to chase — and why. The output is a structured
 * insight that the UI surfaces as a green "Don't chase" badge, plus a
 * sentence explaining the reasoning so the user trusts the call.
 *
 * Pure functions over Invoice + CustomerBehaviourProfile + context.
 * No AI, no I/O. Deterministic so the decision engine can call it for
 * every invoice on every render without cost.
 */

import type { CustomerBehaviourProfile, Invoice } from "@/types/zentra";

/** Why the engine recommends skipping this chase. */
export type StopChasingKind =
  | "reliable_late_payer"      // pays late but always within their normal window
  | "recently_chased"          // we touched them in the last 48h, give it a beat
  | "promise_pending"          // they've already promised a date in the future
  | "tiny_balance_low_overdue"; // not worth the relationship cost

export interface StopChasingInsight {
  kind:        StopChasingKind;
  /** One-sentence reason shown directly to the user on the chase card. */
  message:     string;
  /** Stronger evidence pushes confidence higher (0-100). */
  confidence:  number;
}

interface StopChasingContext {
  daysSinceLastChase: number | null;
  profile?:           CustomerBehaviourProfile;
  referenceDate:      string;
}

/**
 * Returns null when the chase should proceed normally. Returns an insight
 * when the engine has a confident reason to recommend NOT chasing this
 * invoice this week.
 *
 * Ordering matters — the first matching rule wins. Higher-confidence /
 * more-specific rules come first.
 */
export function computeStopChasingInsight(
  invoice: Invoice,
  ctx:     StopChasingContext,
): StopChasingInsight | null {
  // Never suppress chases when the invoice is in an exception state — the
  // chase plan handles those through dedicated scenarios (disputes,
  // remittance, missing AP, etc).
  if (
    invoice.status === "disputed" ||
    invoice.status === "awaiting_remittance" ||
    invoice.status === "awaiting_statement" ||
    invoice.status === "needs_ap_contact" ||
    invoice.status === "missed_promise"
  ) {
    return null;
  }

  // ── Rule 1: a future promise has been made ─────────────────────────────
  if (
    invoice.promisedPaymentDate &&
    isFuture(invoice.promisedPaymentDate, ctx.referenceDate)
  ) {
    return {
      kind:       "promise_pending",
      message:    `${invoice.customerName} has promised payment by ${formatShort(invoice.promisedPaymentDate)} — wait for that date before chasing again.`,
      confidence: 95,
    };
  }

  // ── Rule 2: recently chased ────────────────────────────────────────────
  if (ctx.daysSinceLastChase !== null && ctx.daysSinceLastChase <= 2) {
    return {
      kind:       "recently_chased",
      message:    `Chased ${ctx.daysSinceLastChase}d ago — give it ${3 - ctx.daysSinceLastChase}d to land before chasing again.`,
      confidence: 80,
    };
  }

  // ── Rule 3: reliable late payer (the headline insight) ─────────────────
  // Pays consistently late but inside a tolerable window and doesn't
  // miss promises. Chasing breaks the relationship without speeding it up.
  if (ctx.profile) {
    const p = ctx.profile;
    const enoughHistory = p.totalInvoices >= 3 && p.invoicesPaidLate >= 2;
    const consistentlyLate =
      p.averageDaysLate > 0 &&
      p.averageDaysLate <= 14 &&
      invoice.daysOverdue <= p.averageDaysLate + 3;
    const keepsPromises = (p.missedPromisesCount ?? 0) === 0;
    const noActiveDisputes = (p.disputesCount ?? 0) === 0;

    if (enoughHistory && consistentlyLate && keepsPromises && noActiveDisputes) {
      return {
        kind:       "reliable_late_payer",
        message:    `${invoice.customerName} pays an average of ${p.averageDaysLate}d late but always within their normal window. Chasing now risks the relationship without speeding it up.`,
        confidence: 70,
      };
    }
  }

  // ── Rule 4: tiny balance + barely overdue ──────────────────────────────
  if (invoice.amountOutstanding < 150 && invoice.daysOverdue <= 7) {
    return {
      kind:       "tiny_balance_low_overdue",
      message:    `Only £${invoice.amountOutstanding.toFixed(2)} outstanding and ${invoice.daysOverdue}d overdue — not worth a chase yet.`,
      confidence: 55,
    };
  }

  return null;
}

// ── helpers ────────────────────────────────────────────────────────────────

const DAY_MS = 1000 * 60 * 60 * 24;

function isFuture(date: string, referenceDate: string): boolean {
  return new Date(date).getTime() > new Date(referenceDate).getTime();
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Exported for tests + potential future use in the digest. */
export function _internal_DAY_MS() {
  return DAY_MS;
}
