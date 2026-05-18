/**
 * POST /api/zentra/customer-diagnosis
 *
 * Takes a customer's invoice-history summary and returns an AI-generated
 * (or rules-based fallback) diagnosis of their payment behaviour + a
 * recommended next action.
 *
 * Order of preference:
 *   1. Gemini (if GEMINI_API_KEY is set) — cheapest
 *   2. OpenAI (if OPENAI_API_KEY is set)
 *   3. Deterministic rules fallback (always available, costs nothing)
 *
 * Rate-limited to 30 requests/minute per IP to keep AI spend predictable.
 */

import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildDiagnosisPrompt,
  diagnoseWithRules,
  parseAiDiagnosisResponse,
  type CustomerDiagnosisInput,
  type CustomerDiagnosisResult,
} from "@/lib/ai/customer-diagnosis";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { requireActiveAccount } from "@/lib/server/account-guard";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function POST(request: Request) {
  const { error } = await requireActiveAccount();
  if (error) return error;

  const rateLimit = checkRateLimit(request, {
    namespace: "zentra-customer-diagnosis",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many diagnosis requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let input: CustomerDiagnosisInput;
  try {
    input = (await request.json()) as CustomerDiagnosisInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!input.customerName?.trim()) {
    return NextResponse.json({ error: "customerName is required." }, { status: 400 });
  }

  const fallback = diagnoseWithRules(input);

  // ── Try Gemini first (cheapest) ──────────────────────────────────────────
  const geminiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    try {
      const aiResult = await diagnoseWithGemini(input, geminiKey);
      if (aiResult) return NextResponse.json(aiResult);
    } catch (err) {
      console.error("[customer-diagnosis] Gemini failed:", err);
    }
  }

  // ── Try OpenAI ───────────────────────────────────────────────────────────
  const client = getOpenAIClient();
  if (client) {
    try {
      const aiResult = await diagnoseWithOpenAI(input, client);
      if (aiResult) return NextResponse.json(aiResult);
    } catch (err) {
      console.error("[customer-diagnosis] OpenAI failed:", err);
    }
  }

  // ── Fall back to deterministic rules ─────────────────────────────────────
  return NextResponse.json(fallback);
}

async function diagnoseWithOpenAI(
  input: CustomerDiagnosisInput,
  client: OpenAI,
): Promise<CustomerDiagnosisResult | null> {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You diagnose UK B2B payment behaviour. Be specific, conservative, plain-English. Never recommend legal action or aggressive wording.",
      },
      { role: "user", content: buildDiagnosisPrompt(input) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  return parseAiDiagnosisResponse(completion.choices[0]?.message.content);
}

async function diagnoseWithGemini(
  input: CustomerDiagnosisInput,
  apiKey: string,
): Promise<CustomerDiagnosisResult | null> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: buildDiagnosisPrompt(input) }] },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  return parseAiDiagnosisResponse(text);
}
