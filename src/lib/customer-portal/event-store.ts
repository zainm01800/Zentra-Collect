/**
 * Customer-portal event log.
 *
 * Records customer-side actions (promised dates, "why is this overdue"
 * feedback, payment intents) so the user's dashboard can surface them.
 *
 * Storage strategy:
 *   - In-memory ring buffer (always available, even without Supabase) so
 *     the local dev / preview flow works end-to-end.
 *   - When Supabase is configured, ALSO persists to a `zentra_portal_events`
 *     table so events survive process restarts and can be read across
 *     server instances.
 *
 * The table doesn't exist yet — a migration will need to be added. Until
 * then the in-memory buffer is fine for an MVP demo.
 */

import { createSupabaseServerClient, hasSupabaseServerConfig } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PortalEventType = "promise" | "reason" | "payment_intent";

export interface PortalEventBase {
  invoiceId:    string;
  customerName: string;
  type:         PortalEventType;
  occurredAt:   string;
}

export interface PromiseEvent extends PortalEventBase {
  type:        "promise";
  promiseDate: string;
}

export interface ReasonEvent extends PortalEventBase {
  type:    "reason";
  reason:  string;
}

export interface PaymentIntentEvent extends PortalEventBase {
  type:           "payment_intent";
  /** Stripe checkout session ID for cross-reference. */
  sessionId:      string;
  amountPence:    number;
}

export type PortalEvent = PromiseEvent | ReasonEvent | PaymentIntentEvent;

// ── In-memory ring buffer (process-local, fine for SSR + dev) ────────────────

const MAX_EVENTS = 500;
const buffer: PortalEvent[] = [];

function pushToBuffer(event: PortalEvent) {
  buffer.push(event);
  while (buffer.length > MAX_EVENTS) buffer.shift();
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Record a portal event. Always succeeds (worst case = in-memory only). */
export async function recordPortalEvent(event: PortalEvent): Promise<void> {
  pushToBuffer(event);

  if (hasSupabaseServerConfig()) {
    try {
      const supabase = await createSupabaseServerClient();
      // Soft-fail if the table doesn't exist yet — feature still works
      // via the in-memory buffer until the migration ships.
      await supabase
        .from("zentra_portal_events")
        .insert({
          invoice_id:    event.invoiceId,
          customer_name: event.customerName,
          event_type:    event.type,
          payload:       event,
          occurred_at:   event.occurredAt,
        });
    } catch (err) {
      // Don't break the customer flow on a DB hiccup
      console.error("[portal-events] Supabase insert failed:", err);
    }
  }
}

/** Read the most recent N events — used by the user-facing dashboard later. */
export function readRecentPortalEvents(limit: number = 50): PortalEvent[] {
  return buffer.slice(-limit).reverse();
}
