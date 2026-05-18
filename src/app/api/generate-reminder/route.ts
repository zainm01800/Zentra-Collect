import OpenAI from "openai";
import { NextResponse } from "next/server";
import { buildReminderPrompt, generateTemplateReminder } from "@/lib/reminders";
import type { Invoice, ReminderOptions, ReminderTone } from "@/types/cashpilot";
import { requireActiveAccount } from "@/lib/server/account-guard";
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
  // CB-3: previously unauth'd — anyone with curl could drain the OpenAI key.
  const rate = checkRateLimit(request, { namespace: "generate-reminder", limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const guard = await requireActiveAccount();
  if (guard.error) return guard.error;

  const body = (await request.json()) as {
    invoice?: Invoice;
    tone?: ReminderTone;
    options?: ReminderOptions;
  };

  if (!body.invoice || !body.tone) {
    return NextResponse.json(
      { error: "Invoice and tone are required." },
      { status: 400 },
    );
  }

  const options = body.options ?? {
    mentionPreviousReminder: true,
    askForPaymentDate: true,
    includePaymentLink: true,
    avoidLateFeeWording: true,
    keepRelationshipWarm: true,
  };
  const fallback = generateTemplateReminder(body.invoice, body.tone, options);
  const client = getOpenAIClient();

  if (!client) {
    return NextResponse.json({ ...fallback, source: "template" });
  }

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You write careful, professional credit-control reminder emails for UK service businesses.",
        },
        { role: "user", content: buildReminderPrompt(body.invoice, body.tone, options) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });

    const content = completion.choices[0]?.message.content;
    if (!content) return NextResponse.json({ ...fallback, source: "template" });

    const parsed = JSON.parse(content) as { subject?: string; body?: string };
    return NextResponse.json({
      subject: parsed.subject ?? fallback.subject,
      body: parsed.body ?? fallback.body,
      source: "openai",
    });
  } catch {
    return NextResponse.json({ ...fallback, source: "template" });
  }
}
