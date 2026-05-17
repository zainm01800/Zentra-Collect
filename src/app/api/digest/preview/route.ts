/**
 * POST /api/digest/preview
 *
 * Takes a weekly digest brief from the client (built from their local
 * invoice data) and returns an AI-narrated version. Used by the "Preview
 * digest" button on /digest.
 *
 * Falls back to a deterministic template when no AI keys are configured —
 * the digest still works end-to-end at zero cost.
 */

import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildDigestNarrationPrompt,
  narrateWithTemplate,
  parseAiDigestResponse,
  type NarratedDigest,
} from "@/lib/ai/weekly-digest-narration";
import type { WeeklyDigestBrief } from "@/lib/collections/weekly-digest";
import { checkRateLimit } from "@/lib/server/rate-limit";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

interface PreviewRequest {
  brief: WeeklyDigestBrief;
  recipientName?: string;
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    namespace: "digest-preview",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many preview requests. Please wait a minute." },
      { status: 429 },
    );
  }

  let body: PreviewRequest;
  try {
    body = (await request.json()) as PreviewRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.brief) {
    return NextResponse.json({ error: "brief is required" }, { status: 400 });
  }

  const recipientName = body.recipientName?.trim() || "there";
  const fallback = narrateWithTemplate(body.brief, recipientName);

  // Try Gemini first (cheapest), then OpenAI, then template
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    try {
      const result = await narrateWithGemini(body.brief, recipientName, geminiKey, fallback);
      return NextResponse.json(result);
    } catch (err) {
      console.error("[digest-preview] Gemini failed:", err);
    }
  }

  const client = getOpenAIClient();
  if (client) {
    try {
      const result = await narrateWithOpenAI(body.brief, recipientName, client, fallback);
      return NextResponse.json(result);
    } catch (err) {
      console.error("[digest-preview] OpenAI failed:", err);
    }
  }

  return NextResponse.json(fallback);
}

async function narrateWithOpenAI(
  brief: WeeklyDigestBrief,
  recipientName: string,
  client: OpenAI,
  fallback: NarratedDigest,
): Promise<NarratedDigest> {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You write Sunday-evening weekly briefs for UK bookkeepers. Warm, specific, scannable, never legal advice.",
      },
      { role: "user", content: buildDigestNarrationPrompt(brief, recipientName) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.35,
  });
  return parseAiDigestResponse(completion.choices[0]?.message.content, fallback);
}

async function narrateWithGemini(
  brief: WeeklyDigestBrief,
  recipientName: string,
  apiKey: string,
  fallback: NarratedDigest,
): Promise<NarratedDigest> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: buildDigestNarrationPrompt(brief, recipientName) }] },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!response.ok) return fallback;
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
  return parseAiDigestResponse(text, fallback);
}
