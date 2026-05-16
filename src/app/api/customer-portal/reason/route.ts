/**
 * POST /api/customer-portal/reason
 *
 * Records the customer's "why is this overdue?" feedback. Mirror of
 * the promise route.
 */

import { NextResponse } from "next/server";
import { verifyPaymentToken } from "@/lib/customer-portal/token";
import { recordPortalEvent } from "@/lib/customer-portal/event-store";

const ALLOWED_REASONS = new Set([
  "awaiting_po",
  "in_ap_queue",
  "awaiting_remittance",
  "querying_invoice",
  "wrong_contact",
  "other",
]);

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "");
  const reason = String(formData.get("reason") ?? "");

  if (!token || !reason) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  if (!ALLOWED_REASONS.has(reason)) {
    return new NextResponse("Invalid reason", { status: 400 });
  }

  const verified = verifyPaymentToken(token);
  if (!verified.ok) {
    return new NextResponse("Invalid token", { status: 403 });
  }

  await recordPortalEvent({
    invoiceId:    verified.payload.invoiceId,
    customerName: verified.payload.customerName,
    type:         "reason",
    reason,
    occurredAt:   new Date().toISOString(),
  });

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(
    `${origin}/pay/${token}/reason?submitted=1&reason=${encodeURIComponent(reason)}`,
    303,
  );
}
