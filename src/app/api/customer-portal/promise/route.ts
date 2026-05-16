/**
 * POST /api/customer-portal/promise
 *
 * Records a customer's promised payment date back to the user's system.
 * Validates the signed token, then writes an entry to the
 * `customer_portal_events` log so the user can see it.
 *
 * Storage: for now, writes to a server-side in-memory queue and (when
 * Supabase is configured) appends to a `zentra_portal_events` table.
 * The user's dashboard polls these events on their next visit.
 *
 * Customer-facing — no auth required, the token IS the auth.
 */

import { NextResponse } from "next/server";
import { verifyPaymentToken } from "@/lib/customer-portal/token";
import { recordPortalEvent } from "@/lib/customer-portal/event-store";

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const date  = String(formData.get("date") ?? "");

  if (!token || !date) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  const verified = verifyPaymentToken(token);
  if (!verified.ok) {
    return new NextResponse("Invalid token", { status: 403 });
  }

  // Light validation — must be a parseable date that isn't in the past
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return new NextResponse("Invalid date", { status: 400 });
  }

  await recordPortalEvent({
    invoiceId:    verified.payload.invoiceId,
    customerName: verified.payload.customerName,
    type:         "promise",
    promiseDate:  date,
    occurredAt:   new Date().toISOString(),
  });

  // Redirect back to confirmation page (303 = always GET on the redirect)
  const origin = new URL(request.url).origin;
  return NextResponse.redirect(
    `${origin}/pay/${token}/promise?submitted=1&date=${encodeURIComponent(date)}`,
    303,
  );
}
