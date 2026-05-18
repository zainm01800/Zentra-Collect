import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireActiveAccount } from "@/lib/server/account-guard";
import { checkRateLimit } from "@/lib/server/rate-limit";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const EXTRACTION_PROMPT = (text: string, filename: string) => `Extract invoice data from this text (from PDF: ${filename}).

Return JSON: {"invoices": [...]}

Each invoice object:
- customerName: string (the company/person being billed — NOT the sender)
- customerEmail: string | null
- invoiceNumber: string (invoice ref, e.g. INV-001)
- invoiceDate: string | null (YYYY-MM-DD)
- dueDate: string | null (YYYY-MM-DD)
- amount: number (total owed, positive, no currency symbols)
- currency: string ("GBP" default)
- description: string | null (what the invoice is for)

Rules:
- Aged debt / statement reports: each unpaid invoice row is a separate object.
- Single invoice PDF: return one object.
- Ignore paid or zero-balance rows.
- Dates must be YYYY-MM-DD.

Text:
${text.slice(0, 8000)}`;

async function extractWithGemini(text: string, filename: string, apiKey: string) {
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: EXTRACTION_PROMPT(text, filename) }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{"invoices":[]}';
  const parsed = JSON.parse(raw) as { invoices?: unknown[] };
  return Array.isArray(parsed.invoices) ? parsed.invoices : [];
}

async function extractWithOpenAI(text: string, filename: string, client: OpenAI) {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [{ role: "user", content: EXTRACTION_PROMPT(text, filename) }],
    response_format: { type: "json_object" },
    temperature: 0,
  });
  const raw = completion.choices[0]?.message?.content ?? '{"invoices":[]}';
  const parsed = JSON.parse(raw) as { invoices?: unknown[] };
  return Array.isArray(parsed.invoices) ? parsed.invoices : [];
}

export async function POST(req: NextRequest) {
  try {
    // CB-4: previously unauth'd — anyone could drain the AI key.
    const rate = checkRateLimit(req, { namespace: "extract-pdf", limit: 10, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    const guard = await requireActiveAccount();
    if (guard.error) return guard.error;

    const { text, filename } = (await req.json()) as { text: string; filename?: string };

    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const name = filename ?? "invoice.pdf";

    // Gemini takes priority (same pattern as all other AI routes in this app)
    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (geminiKey) {
      const invoices = await extractWithGemini(text, name, geminiKey);
      return NextResponse.json({ invoices });
    }

    const openai = getOpenAI();
    if (openai) {
      const invoices = await extractWithOpenAI(text, name, openai);
      return NextResponse.json({ invoices });
    }

    return NextResponse.json(
      { error: "No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY." },
      { status: 503 }
    );
  } catch (err) {
    console.error("[extract-pdf]", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
