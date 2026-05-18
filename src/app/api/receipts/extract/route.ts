/**
 * POST /api/receipts/extract
 *
 * Receipt OCR for the expenses flow. The user uploads a photo of a
 * receipt, we send it to Gemini Vision, and return the parsed fields:
 *   { vendor, date, amount, category, currency }
 *
 * Server-side only. Gemini API key never reaches the browser. Falls
 * back to OpenAI Vision (gpt-4o-mini) if Gemini isn't configured.
 *
 * Auth: requires a signed-in account (uses requireActiveAccount so
 * expired/cancelled accounts can't drain the AI key).
 *
 * Rate limit: 30 requests/min per IP. Generous for normal use, tight
 * enough to block scrapers.
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireActiveAccount } from "@/lib/server/account-guard";
import { checkRateLimit } from "@/lib/server/rate-limit";

const EXTRACTION_PROMPT = `Extract the key fields from this receipt photo.

Return ONLY valid JSON in this exact shape:
{
  "vendor": "string — the merchant / shop name",
  "date": "string — YYYY-MM-DD, the receipt date",
  "amount": number — total paid (positive, no currency symbols),
  "currency": "string — 'GBP', 'EUR', 'USD'… inferred from the symbol or country, default 'GBP'",
  "category": "string — one of: travel, fuel, meals, software, office, professional, marketing, utilities, supplies, other"
}

Rules:
- If a field is illegible or missing, omit it from the response.
- Date format MUST be YYYY-MM-DD. Convert from any other format.
- amount is the FINAL total paid (after tax/tip), not subtotal.
- category should be your best guess based on vendor + line items.
- Return JSON only — no commentary, no markdown fences.`;

interface ExtractedReceipt {
  vendor?:   string;
  date?:     string;
  amount?:   number;
  currency?: string;
  category?: string;
}

// ── Gemini Vision ────────────────────────────────────────────────────────────

async function extractWithGemini(
  imageBase64: string,
  mimeType:    string,
  apiKey:      string,
): Promise<ExtractedReceipt> {
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: EXTRACTION_PROMPT },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini Vision error ${res.status}`);
  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try {
    return JSON.parse(raw) as ExtractedReceipt;
  } catch {
    return {};
  }
}

// ── OpenAI Vision fallback ───────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

async function extractWithOpenAI(
  imageBase64: string,
  mimeType:    string,
  client:      OpenAI,
): Promise<ExtractedReceipt> {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: EXTRACTION_PROMPT },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
      ],
    }],
    response_format: { type: "json_object" },
    temperature: 0,
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as ExtractedReceipt;
  } catch {
    return {};
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(req, { namespace: "receipts-extract", limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const guard = await requireActiveAccount();
  if (guard.error) return guard.error;

  try {
    // Expect multipart with `file`, OR JSON with { imageBase64, mimeType }.
    const contentType = req.headers.get("content-type") ?? "";
    let imageBase64: string;
    let mimeType:    string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
      }
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json({ error: "Image too large (max 8MB)." }, { status: 413 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      imageBase64 = buf.toString("base64");
      mimeType = file.type || "image/jpeg";
    } else {
      const body = await req.json() as { imageBase64?: string; mimeType?: string };
      if (!body.imageBase64) {
        return NextResponse.json({ error: "imageBase64 required" }, { status: 400 });
      }
      imageBase64 = body.imageBase64;
      mimeType = body.mimeType ?? "image/jpeg";
    }

    // Gemini takes priority; OpenAI is the fallback.
    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (geminiKey) {
      const parsed = await extractWithGemini(imageBase64, mimeType, geminiKey);
      return NextResponse.json({ receipt: parsed, source: "gemini" });
    }
    const openai = getOpenAI();
    if (openai) {
      const parsed = await extractWithOpenAI(imageBase64, mimeType, openai);
      return NextResponse.json({ receipt: parsed, source: "openai" });
    }
    return NextResponse.json(
      { error: "No vision provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY." },
      { status: 503 },
    );
  } catch (err) {
    console.error("[receipts/extract]", err);
    return NextResponse.json({ error: "Extraction failed." }, { status: 500 });
  }
}
