/**
 * Tone × customer learning.
 *
 * Tracks which chase tone has worked for which customer over time. After
 * 2+ outcomes per customer, the engine can recommend "Use Firm with Acme,
 * Friendly hasn't worked" rather than relying purely on the static risk
 * profile.
 *
 * Storage is localStorage-first: a small ring buffer of outcomes per
 * customer keyed by customerId. This keeps the feature working without
 * a backend round-trip and avoids gating learning behind Supabase setup.
 *
 * All functions are SSR-safe (return defaults when window is undefined).
 */

import type { ReminderTone } from "@/types/cashpilot";

const STORAGE_KEY = "zn:tone-outcomes:v1";
const MAX_PER_CUSTOMER = 12;

export type ToneOutcome = "paid" | "promised" | "responded" | "ignored";

export interface ToneEvent {
  customerId: string;
  tone:       ReminderTone;
  outcome:    ToneOutcome;
  /** ISO date of the outcome — used for recency weighting. */
  at:         string;
}

interface ToneStore {
  [customerId: string]: ToneEvent[];
}

// ── persistence ────────────────────────────────────────────────────────────

function readStore(): ToneStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: ToneStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota exceeded — drop silently */
  }
}

// ── public API ─────────────────────────────────────────────────────────────

export function recordToneOutcome(event: ToneEvent): void {
  const store = readStore();
  const existing = store[event.customerId] ?? [];
  const next = [event, ...existing].slice(0, MAX_PER_CUSTOMER);
  store[event.customerId] = next;
  writeStore(store);
}

export function getCustomerToneHistory(customerId: string): ToneEvent[] {
  const store = readStore();
  return store[customerId] ?? [];
}

export interface ToneRecommendation {
  recommendedTone: ReminderTone;
  /** Why this tone — used directly in the UI hint. */
  rationale:       string;
  /** Number of data points the recommendation is based on. */
  sampleSize:      number;
  /** True when we have enough data to recommend (≥2 outcomes). */
  confident:       boolean;
}

/**
 * Compute the recommended tone for a customer from their outcome history.
 *
 * Algorithm:
 *   - Score each tone by `(successes - half × failures)`, where success =
 *     paid or promised, failure = ignored.
 *   - Pick the highest scoring tone with sample size ≥ 2.
 *   - When two tones tie, prefer the *softer* one (Friendly > Neutral >
 *     Firm > Final notice) — softer is cheaper to the relationship.
 *
 * Returns null when the customer has no history at all (caller should
 * fall back to the risk-based heuristic in customer-behaviour.ts).
 */
export function recommendTone(customerId: string): ToneRecommendation | null {
  const events = getCustomerToneHistory(customerId);
  if (events.length === 0) return null;

  type Tally = { successes: number; failures: number; total: number };
  const byTone = new Map<ReminderTone, Tally>();

  for (const e of events) {
    const t = byTone.get(e.tone) ?? { successes: 0, failures: 0, total: 0 };
    t.total += 1;
    if (e.outcome === "paid" || e.outcome === "promised") t.successes += 1;
    if (e.outcome === "ignored") t.failures += 1;
    byTone.set(e.tone, t);
  }

  const softness: Record<ReminderTone, number> = {
    Friendly:       1,
    Neutral:        2,
    Firm:           3,
    "Final notice": 4,
  };

  const scored = Array.from(byTone.entries())
    .map(([tone, t]) => ({
      tone,
      score:  t.successes - t.failures * 0.5,
      sample: t.total,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return softness[a.tone] - softness[b.tone];
    });

  const winner = scored[0];
  const confident = events.length >= 2;
  const losers = scored.slice(1).filter((s) => s.sample > 0);
  const loserMention = losers.length
    ? ` (${losers.map((l) => `${l.tone} didn't land`).join(", ")})`
    : "";

  return {
    recommendedTone: winner.tone,
    rationale: confident
      ? `${winner.tone} has worked best for this customer${loserMention}.`
      : `Only one chase recorded so far — using ${winner.tone} provisionally.`,
    sampleSize: events.length,
    confident,
  };
}

/** For tests + the upcoming "wipe my data" settings button. */
export function _clearToneLearning(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
