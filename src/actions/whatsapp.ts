"use server";

/**
 * src/actions/whatsapp.ts
 *
 * Sends a WhatsApp message via Twilio's REST API.
 *
 * Environment variables required:
 *   TWILIO_ACCOUNT_SID     — your Twilio account SID (starts with "AC")
 *   TWILIO_AUTH_TOKEN      — your Twilio auth token
 *   TWILIO_WHATSAPP_FROM   — the WhatsApp-enabled number, e.g. +14155238886
 *                            (the Twilio sandbox number, or your approved WABA number)
 *
 * Sandbox testing:
 *   Join the sandbox by WhatsApp-messaging "join <sandbox-word>" to +14155238886.
 *   Messages sent from the sandbox are free and count against your trial quota.
 *
 * First-contact rules (production):
 *   You can only initiate a WhatsApp conversation using an approved template.
 *   Session messages (free-form replies) are allowed within 24 h of a customer reply.
 *   For MVP we send free-form; users must ensure their number is opted-in.
 */

export interface SendWhatsAppInput {
  /** Recipient phone number in E.164 format, e.g. "+447700900000" */
  to:           string;
  message:      string;
  invoiceRef?:  string;
  clientName?:  string;
}

export type SendWhatsAppResult =
  | { ok: true;  sid: string }
  | { ok: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN  &&
    process.env.TWILIO_WHATSAPP_FROM,
  );
}

/** Normalise a phone number to E.164 (+44…) — strips spaces, dashes, brackets. */
function normalisePhone(raw: string): string {
  // Keep only digits and leading +
  const stripped = raw.trim().replace(/[\s\-().]/g, "");
  if (!stripped.startsWith("+")) {
    // Assume UK if no country code given
    const digits = stripped.replace(/^0/, "");
    return `+44${digits}`;
  }
  return stripped;
}

// ── Main action ───────────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(
  input: SendWhatsAppInput,
): Promise<SendWhatsAppResult> {
  if (!isConfigured()) {
    return {
      ok:    false,
      error: "WhatsApp is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM to your environment.",
    };
  }

  if (!input.to.trim()) {
    return { ok: false, error: "Recipient phone number is required." };
  }
  if (!input.message.trim()) {
    return { ok: false, error: "Message cannot be empty." };
  }

  const to        = normalisePhone(input.to);
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken  = process.env.TWILIO_AUTH_TOKEN!;
  const from       = `whatsapp:${process.env.TWILIO_WHATSAPP_FROM!}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const body = new URLSearchParams({
    From: from,
    To:   `whatsapp:${to}`,
    Body: input.message,
  });

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = (await res.json()) as { sid?: string; message?: string; code?: number };

    if (!res.ok) {
      const msg = data.message ?? `Twilio error ${res.status}`;
      return { ok: false, error: msg };
    }

    return { ok: true, sid: data.sid ?? "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown network error";
    console.error("[sendWhatsAppMessage]", err);
    return { ok: false, error: msg };
  }
}
