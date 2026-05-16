/**
 * AI narration on top of the deterministic weekly digest brief.
 *
 * Takes the structured brief (numbers, top customers, missed promises)
 * and asks an LLM to write a friendly, actionable 4-paragraph narrative
 * that reads like a Sunday-night briefing from a smart colleague.
 *
 * Falls back to a deterministic template when no AI keys are configured.
 */

import type { WeeklyDigestBrief } from "@/lib/collections/weekly-digest";

// ── Result ────────────────────────────────────────────────────────────────────

export interface NarratedDigest {
  /** Subject line for the email. */
  subject:       string;
  /** Short greeting line: "Morning Sarah — here's your week ahead." */
  greeting:      string;
  /** 2-3 sentence "what happened this week" recap. */
  recap:         string;
  /** 2-3 sentence "what to focus on this week" forward look. */
  focus:         string;
  /** "Top 3 customers to chase first" bullet list. */
  topActions:    Array<{ customer: string; reason: string; amount: string }>;
  /** Sign-off line. */
  signoff:       string;
  /** Source attribution — "ai" | "template". */
  source:        "ai" | "template";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Deterministic template fallback ──────────────────────────────────────────

/**
 * Produce a narrated digest without calling an LLM. Used when no AI keys
 * are configured. Less expressive than the AI version but always available.
 */
export function narrateWithTemplate(
  brief: WeeklyDigestBrief,
  recipientName: string = "there",
): NarratedDigest {
  const promisesText =
    brief.missedPromises > 0
      ? `${brief.missedPromises} promise${brief.missedPromises === 1 ? "" : "s"} slipped past their date.`
      : "No promises were broken this week.";

  const cashText =
    brief.cashLikelyToLandThisWeek > 0
      ? `${fmtGBP(brief.cashLikelyToLandThisWeek)} is likely to land this week if the schedule holds.`
      : "No cash is currently scheduled to land this week.";

  const recap =
    `Last week's snapshot: ${fmtGBP(brief.totalCashNeedingAttention)} sitting overdue across ${brief.actionsRecommendedThisWeek} active recommendation${brief.actionsRecommendedThisWeek === 1 ? "" : "s"}. ${promisesText}`;

  const focus =
    `${cashText} ${brief.biggestBlocker ? `Biggest blocker: ${brief.biggestBlocker.toLowerCase()}.` : "No single account is blocking the queue."} ${brief.recommendedFocus}`;

  return {
    subject:    brief.emailSubject || `Your Zentra Collect week — ${brief.weekStarting}`,
    greeting:   `Hi ${recipientName} — here's your week ahead.`,
    recap,
    focus,
    topActions: brief.topCustomersToReview.slice(0, 3).map((c) => ({
      customer: c.customerName,
      reason:   c.reason,
      amount:   fmtGBP(c.amountOutstanding),
    })),
    signoff:    "Have a productive week.",
    source:     "template",
  };
}

// ── AI prompt (used by the API route) ─────────────────────────────────────────

export function buildDigestNarrationPrompt(
  brief: WeeklyDigestBrief,
  recipientName: string,
): string {
  const topCustomers = brief.topCustomersToReview.slice(0, 5).map((c) =>
    `- ${c.customerName} (${fmtGBP(c.amountOutstanding)}) · risk: ${c.riskLabel ?? "unknown"} · reason: ${c.reason}`,
  ).join("\n");

  return `You are writing a Sunday-evening Zentra Collect weekly brief for a UK bookkeeper. The audience reads this with coffee — make it scannable, warm, specific, and actionable. Never give legal advice. Refer to UK statutory protections only when relevant.

Return ONLY valid JSON with this exact shape:
{
  "subject": "...",
  "greeting": "...",
  "recap": "2-3 sentences on what happened last week",
  "focus": "2-3 sentences on what to focus on this coming week",
  "topActions": [{"customer": "...", "reason": "concrete one-line reason", "amount": "£..."}],
  "signoff": "..."
}

Constraints:
- "subject" max 60 chars, no emoji
- "greeting" addresses the user by name: "${recipientName}"
- topActions has exactly 3 items (pick the most impactful 3 from the customer list)
- Avoid the words: legal action, lawsuit, court, debt collector
- Plain English. No jargon. No bullets in the prose fields (recap, focus).

Data:
Week starting:                   ${brief.weekStarting}
Total cash needing attention:    ${fmtGBP(brief.totalCashNeedingAttention)}
Cash likely to land this week:   ${fmtGBP(brief.cashLikelyToLandThisWeek)}
Actions recommended this week:   ${brief.actionsRecommendedThisWeek}
Promises due this week:          ${brief.promisesDueThisWeek}
Missed promises:                 ${brief.missedPromises}
Unresolved disputes:             ${brief.unresolvedDisputes}
Biggest blocker:                 ${brief.biggestBlocker || "none"}
Changed since last import:       ${brief.changedSinceLastImport || "no recent imports"}
Recommended focus (rules-based): ${brief.recommendedFocus}

Top customers to review:
${topCustomers || "(no customers flagged)"}`;
}

/** Normalise an LLM JSON response to a NarratedDigest. */
export function parseAiDigestResponse(
  raw: string | null | undefined,
  fallback: NarratedDigest,
): NarratedDigest {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<NarratedDigest>;
    return {
      subject:    typeof parsed.subject === "string" ? parsed.subject.slice(0, 100) : fallback.subject,
      greeting:   typeof parsed.greeting === "string" ? parsed.greeting.slice(0, 200) : fallback.greeting,
      recap:      typeof parsed.recap === "string" ? parsed.recap.slice(0, 800) : fallback.recap,
      focus:      typeof parsed.focus === "string" ? parsed.focus.slice(0, 800) : fallback.focus,
      topActions: Array.isArray(parsed.topActions)
        ? parsed.topActions.slice(0, 3).map((a: { customer?: string; reason?: string; amount?: string }) => ({
            customer: typeof a.customer === "string" ? a.customer.slice(0, 80) : "Unknown",
            reason:   typeof a.reason === "string" ? a.reason.slice(0, 200) : "",
            amount:   typeof a.amount === "string" ? a.amount.slice(0, 40) : "",
          }))
        : fallback.topActions,
      signoff:    typeof parsed.signoff === "string" ? parsed.signoff.slice(0, 200) : fallback.signoff,
      source:     "ai",
    };
  } catch {
    return fallback;
  }
}

// ── HTML email renderer ──────────────────────────────────────────────────────

/** Render a narrated digest as a simple HTML email body. */
export function renderDigestEmailHtml(narrated: NarratedDigest, businessName: string = "Zentra Collect"): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const topActionsHtml = narrated.topActions.length
    ? `<ol style="margin:16px 0;padding-left:20px;">${narrated.topActions
        .map(
          (a) => `
        <li style="margin-bottom:8px;line-height:1.5;">
          <strong>${escape(a.customer)}</strong>${a.amount ? ` <span style="color:#666;">— ${escape(a.amount)}</span>` : ""}<br>
          <span style="color:#444;font-size:14px;">${escape(a.reason)}</span>
        </li>`,
        )
        .join("")}</ol>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escape(narrated.subject)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1d1813;line-height:1.6;">
  <p style="font-size:14px;color:#8a7d69;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin:0 0 8px;">Weekly brief · ${escape(businessName)}</p>
  <h1 style="font-size:22px;font-weight:600;margin:0 0 24px;">${escape(narrated.greeting)}</h1>

  <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8a7d69;margin:24px 0 8px;">Last week</h2>
  <p style="margin:0;font-size:15px;">${escape(narrated.recap)}</p>

  <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8a7d69;margin:24px 0 8px;">This week's focus</h2>
  <p style="margin:0;font-size:15px;">${escape(narrated.focus)}</p>

  ${narrated.topActions.length ? `
  <h2 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#8a7d69;margin:24px 0 8px;">Top 3 to chase first</h2>
  ${topActionsHtml}` : ""}

  <p style="margin:32px 0 0;font-size:15px;color:#444;">${escape(narrated.signoff)}</p>

  <hr style="margin:32px 0;border:0;border-top:1px solid #e8ddc8;">
  <p style="font-size:11px;color:#8a7d69;line-height:1.5;">
    Generated by Zentra Collect.
    ${narrated.source === "ai" ? "AI-narrated from your account data." : "Generated from your account data."}
    Always review before acting on recommendations.
  </p>
</body>
</html>`;
}

/** Render a narrated digest as plain text for email fallback. */
export function renderDigestEmailText(narrated: NarratedDigest): string {
  const lines: string[] = [
    narrated.greeting,
    "",
    "LAST WEEK",
    narrated.recap,
    "",
    "THIS WEEK'S FOCUS",
    narrated.focus,
    "",
  ];
  if (narrated.topActions.length) {
    lines.push("TOP 3 TO CHASE FIRST");
    narrated.topActions.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.customer}${a.amount ? ` — ${a.amount}` : ""}`);
      if (a.reason) lines.push(`   ${a.reason}`);
    });
    lines.push("");
  }
  lines.push(narrated.signoff);
  lines.push("");
  lines.push("---");
  lines.push("Generated by Zentra Collect. Always review before acting.");
  return lines.join("\n");
}
