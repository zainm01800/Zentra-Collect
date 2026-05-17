import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildDraftPrompt,
  generateTemplateDraft,
  getDraftSafety,
  type DraftGenerationInput,
  type DraftGenerationResponse,
} from "@/lib/ai/zentra-drafts";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(request, {
    namespace: "zentra-generate-draft",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many draft requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let input: DraftGenerationInput;

  try {
    input = (await request.json()) as DraftGenerationInput;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const validation = validateInput(input);
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }

  const fallback = generateTemplateDraft(input);
  const safety = getDraftSafety(input);

  if (!safety.allowed) {
    return NextResponse.json({
      ...fallback,
      riskNotes: safety.riskNotes.join(" "),
      confidence: safety.confidence,
      source: "template",
    });
  }

  try {
    const geminiKey =
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (geminiKey) {
      const gemini = await generateWithGemini(input, geminiKey);
      return NextResponse.json(normaliseDraft(gemini, fallback, "gemini"));
    }

    const client = getOpenAIClient();
    if (client) {
      const openai = await generateWithOpenAI(input, client);
      return NextResponse.json(normaliseDraft(openai, fallback, "openai"));
    }
  } catch {
    return NextResponse.json(fallback);
  }

  return NextResponse.json(fallback);
}

async function generateWithOpenAI(
  input: DraftGenerationInput,
  client: OpenAI,
) {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You write safe, professional UK collections emails. The user will send these from their own inbox, signed as themselves (never as Zentra). You never provide legal advice.",
      },
      { role: "user", content: buildDraftPrompt(input) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.35,
    // Cap output tokens — body is ~150 words, plus subject + JSON overhead.
    // Prevents cost runaway from a chatty model.
    max_tokens: 500,
  });

  return parseDraftJson(completion.choices[0]?.message.content);
}

async function generateWithGemini(
  input: DraftGenerationInput,
  apiKey: string,
) {
  const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildDraftPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
          maxOutputTokens: 500,
        },
      }),
    },
  );

  if (!response.ok) throw new Error("Gemini draft generation failed.");
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseDraftJson(text);
}

function parseDraftJson(text: string | null | undefined) {
  if (!text) return null;
  return JSON.parse(text) as Partial<DraftGenerationResponse>;
}

function normaliseDraft(
  draft: Partial<DraftGenerationResponse> | null,
  fallback: DraftGenerationResponse,
  source: "gemini" | "openai",
): DraftGenerationResponse {
  if (!draft) return fallback;

  return {
    subject: draft.subject || fallback.subject,
    body: draft.body || fallback.body,
    suggestedNextStep: draft.suggestedNextStep || fallback.suggestedNextStep,
    riskNotes: draft.riskNotes || fallback.riskNotes,
    confidence:
      draft.confidence === "high" ||
      draft.confidence === "medium" ||
      draft.confidence === "low"
        ? draft.confidence
        : fallback.confidence,
    requiresReview: true,
    source,
  };
}

function validateInput(input: DraftGenerationInput) {
  if (!input?.scenario) return "Scenario is required.";
  if (!input.customerName) return "Customer name is required.";
  if (!input.invoiceNumber) return "Invoice number is required.";
  if (typeof input.amountOutstanding !== "number") {
    return "Amount outstanding is required.";
  }
  if (!input.selectedTone) return "Selected tone is required.";
  return null;
}
