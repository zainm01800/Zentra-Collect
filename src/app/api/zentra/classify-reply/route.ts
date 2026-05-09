import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildReplyClassificationPrompt,
  classifyReplyWithRules,
  type ReplyClassificationInput,
  type ReplyClassificationResult,
} from "@/lib/ai/reply-classifier";
import { checkRateLimit } from "@/lib/server/rate-limit";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(request, {
    namespace: "zentra-classify-reply",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many classification requests. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let input: ReplyClassificationInput;

  try {
    input = (await request.json()) as ReplyClassificationInput;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  if (!input.replyText?.trim()) {
    return NextResponse.json(
      { error: "Reply text is required." },
      { status: 400 },
    );
  }

  const rulesResult = classifyReplyWithRules(input);
  if (rulesResult.classification !== "unclear") {
    return NextResponse.json(rulesResult);
  }

  try {
    const geminiKey =
      process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (geminiKey) {
      const aiResult = await classifyWithGemini(input, geminiKey);
      return NextResponse.json(aiResult);
    }

    const client = getOpenAIClient();
    if (client) {
      const aiResult = await classifyWithOpenAI(input, client);
      return NextResponse.json(aiResult);
    }
  } catch {
    return NextResponse.json(rulesResult);
  }

  return NextResponse.json(rulesResult);
}

async function classifyWithOpenAI(
  input: ReplyClassificationInput,
  client: OpenAI,
) {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You classify customer AR replies for Zentra Collect. Be conservative and always require human review.",
      },
      { role: "user", content: buildReplyClassificationPrompt(input) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  return normaliseAiResult(completion.choices[0]?.message.content);
}

async function classifyWithGemini(
  input: ReplyClassificationInput,
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
            parts: [{ text: buildReplyClassificationPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) throw new Error("Gemini classification failed.");
  const json = await response.json();
  return normaliseAiResult(json.candidates?.[0]?.content?.parts?.[0]?.text);
}

function normaliseAiResult(text: string | null | undefined): ReplyClassificationResult {
  if (!text) {
    return classifyReplyWithRules({ replyText: "" });
  }

  const parsed = JSON.parse(text) as Partial<ReplyClassificationResult>;
  return {
    classification: parsed.classification ?? "unclear",
    confidence:
      parsed.confidence === "high" ||
      parsed.confidence === "medium" ||
      parsed.confidence === "low"
        ? parsed.confidence
        : "low",
    reason: parsed.reason ?? "AI classification did not include a reason.",
    suggestedStatusUpdate: parsed.suggestedStatusUpdate ?? "Manual review",
    suggestedNextAction:
      parsed.suggestedNextAction ??
      "Read the reply and choose the right next action manually.",
    extractedPromiseDate: parsed.extractedPromiseDate || undefined,
    extractedPromiseAmount:
      typeof parsed.extractedPromiseAmount === "number"
        ? parsed.extractedPromiseAmount
        : undefined,
    extractedDisputeReason: parsed.extractedDisputeReason || undefined,
    requiresManualReview: true,
    source: "ai",
  };
}
