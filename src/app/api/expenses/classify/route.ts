/**
 * POST /api/expenses/classify
 *
 * Batch AI classifier for bank-imported expense transactions.
 * Accepts up to 50 items per request. Returns category + allowability
 * for each item using a UK HMRC–aware prompt.
 *
 * Uses Gemini (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY) with
 * OpenAI as fallback if OPENAI_API_KEY is also set.
 *
 * Only called for transactions that the rule-based classifyExpense()
 * could not confidently categorise (i.e. category === "Other").
 */

import { NextRequest, NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/server/account-guard";
import { checkRateLimit } from "@/lib/server/rate-limit";

// ── Categories the AI may choose from ────────────────────────────────────────

const HMRC_CATEGORIES = [
  // People
  "Salaries & wages", "Subcontractors & freelancers", "Employer NI contributions",
  "Pension contributions", "Staff expenses & allowances", "Recruitment costs",
  // Travel
  "Business mileage", "Public transport", "Taxis & ride-hailing", "Flights",
  "Hotels & accommodation", "Parking & congestion charge", "Vehicle hire & lease",
  "Vehicle insurance (business use)",
  // Office
  "Stationery & supplies", "Postage & couriers", "Printing & copying",
  "Office equipment (small items)", "Trade subscriptions & publications", "Office sundries",
  // Premises
  "Business rent", "Business rates", "Gas, electric & water", "Repairs & maintenance",
  "Building insurance", "Cleaning & janitorial", "Security",
  "Home office (flat rate)", "Home office (proportion of bills)",
  // Technology
  "Computer & hardware", "Software & subscriptions", "Cloud services & hosting",
  "Mobile phone (business)", "Internet & broadband", "Specialist tools & equipment",
  "Machinery", "IT support & maintenance",
  // Professional
  "Accountancy & bookkeeping", "Legal fees", "Professional indemnity insurance",
  "Public liability insurance", "Business insurance (other)", "Consultancy fees",
  "Debt collection costs",
  // Marketing
  "Advertising & digital marketing", "Website design & development", "PR & media",
  "Social media & content creation", "Client entertainment (50% rule)",
  "Staff entertainment", "Samples & promotional materials", "Trade shows & exhibitions",
  // Finance
  "Bank charges & fees", "Payment processing fees", "Business loan interest",
  "Hire purchase interest", "Overdraft charges", "Currency exchange losses",
  "Merchant account fees",
  // Training
  "Training courses & workshops", "Conferences & seminars", "Books & trade publications",
  "Professional body subscriptions", "Industry memberships", "Online learning & certifications",
  // Health & safety
  "Protective clothing & PPE", "Eye tests (VDU workers)", "First aid & safety equipment",
  "Health & safety training",
  // Fallback
  "Other",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface InputItem {
  id:          string;
  description: string;
  amount:      number;
}

interface OutputItem {
  id:           string;
  category:     string;
  allowability: "allowable" | "not-allowable";
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(items: InputItem[]): string {
  const categoriesList = HMRC_CATEGORIES.join(", ");
  return `You are a UK self-employed tax assistant. Classify each bank transaction as an HMRC-allowable business expense.

Allowed categories (pick the closest):
${categoriesList}

Rules:
- Mark "not-allowable" for clearly personal spend: groceries, takeaways, clothing, entertainment, gaming, streaming, gyms, holidays. For these, set category to a plain English label describing what it is (e.g. "Groceries", "Takeaway food", "Personal clothing", "Gym membership", "Streaming subscription") — do NOT use the HMRC business categories above.
- Mark "allowable" with the best matching HMRC category from the list above for business spend: software, hosting, professional services, travel for work, office supplies, etc.
- For ambiguous items (restaurants that could be client meals, equipment with unclear use), mark "allowable" with category "Other".
- Use UK HMRC s34 ITTOIA 2005 — expenses must be wholly and exclusively for trade.

Transactions to classify (JSON array):
${JSON.stringify(items.map((i) => ({ id: i.id, description: i.description, amount: i.amount })))}

Respond with ONLY a JSON array (no markdown, no explanation) matching this schema:
[{ "id": "<same id>", "category": "<HMRC category from list, or plain-English personal label for not-allowable>", "allowability": "allowable" | "not-allowable" }]`;
}

// ── Gemini classifier ─────────────────────────────────────────────────────────

async function classifyWithGemini(items: InputItem[], apiKey: string): Promise<OutputItem[]> {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(items) }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          maxOutputTokens: 2000,
        },
      }),
    },
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Gemini ${response.status}: ${errBody}`);
  }

  const json = await response.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

  // Strip markdown fences just in case
  const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini JSON parse failed. Raw: ${cleaned.slice(0, 200)}`);
  }

  return parsed as OutputItem[];
}

// ── OpenAI classifier (fallback) ──────────────────────────────────────────────

async function classifyWithOpenAI(items: InputItem[], apiKey: string): Promise<OutputItem[]> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: buildPrompt(items) }],
    temperature: 0.1,
    max_tokens: 2000,
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
  const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  return JSON.parse(cleaned) as OutputItem[];
}

// ── Sanitise AI output ────────────────────────────────────────────────────────

function sanitise(parsed: OutputItem[]): OutputItem[] {
  const validCategories = new Set<string>(HMRC_CATEGORIES);
  return parsed.map((r) => {
    const allowability = r.allowability === "not-allowable" ? "not-allowable" : "allowable";
    // For allowable items, force category to a known HMRC category (or "Other").
    // For not-allowable items, keep the AI's raw label (e.g. "Groceries", "Personal clothing")
    // so users can see why it was rejected — the HMRC list is business-only.
    const category =
      allowability === "not-allowable"
        ? (r.category?.trim() || "Personal / non-business")
        : (validCategories.has(r.category) ? r.category : "Other");
    return { id: r.id, category, allowability };
  });
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth guard
  const { error } = await requireActiveAccount();
  if (error) return NextResponse.json({ error }, { status: 401 });

  // Rate limit — 20 req/min (generous; each call classifies up to 50 items)
  const rateLimit = checkRateLimit(request, { limit: 20, windowMs: 60_000, namespace: "expenses-classify" });
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let items: InputItem[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }
    items = body.items.slice(0, 50); // hard cap
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    return NextResponse.json(
      { error: "AI classification unavailable — add GEMINI_API_KEY or OPENAI_API_KEY to your environment variables" },
      { status: 503 },
    );
  }

  try {
    let parsed: OutputItem[];

    if (geminiKey) {
      parsed = await classifyWithGemini(items, geminiKey);
    } else {
      parsed = await classifyWithOpenAI(items, openaiKey!);
    }

    return NextResponse.json({ results: sanitise(parsed) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[expenses/classify] AI error:", msg);
    return NextResponse.json(
      { error: "AI classification failed", detail: msg },
      { status: 500 },
    );
  }
}
