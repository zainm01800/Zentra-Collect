/**
 * POST /api/expenses/classify
 *
 * Batch AI classifier for bank-imported expense transactions.
 * Accepts up to 50 items per request. Returns category + allowability
 * for each item using a UK HMRC–aware prompt.
 *
 * Only called for transactions that the rule-based classifyExpense()
 * could not confidently categorise (i.e. returned allowability:"review").
 */

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireActiveAccount } from "@/lib/server/account-guard";
import { checkRateLimit } from "@/lib/server/rate-limit";

// ── OpenAI client ─────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth guard
  const { error } = await requireActiveAccount();
  if (error) return NextResponse.json({ error }, { status: 401 });

  // Rate limit — 20 req/min (generous; each call classifies up to 50 items)
  const rateLimit = checkRateLimit(request, { maxRequests: 20, windowMs: 60_000 });
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

  const client = getOpenAIClient();
  if (!client) {
    // No API key configured — return "Other / review" so UI falls back gracefully
    return NextResponse.json({
      results: items.map((item) => ({
        id:           item.id,
        category:     "Other",
        allowability: "review" as const,
      })),
    });
  }

  const categoriesList = HMRC_CATEGORIES.join(", ");

  const prompt = `You are a UK self-employed tax assistant. Classify each bank transaction as an HMRC-allowable business expense.

Allowed categories (pick the closest):
${categoriesList}

Rules:
- Mark "not-allowable" for clearly personal spend: groceries, takeaways, clothing, entertainment, gaming, streaming, gyms, holidays.
- Mark "allowable" with the best matching category for business spend: software, hosting, professional services, travel for work, office supplies, etc.
- For ambiguous items (restaurants that could be client meals, equipment with unclear use), mark "allowable" with category "Other".
- Use UK HMRC s34 ITTOIA 2005 — expenses must be wholly and exclusively for trade.

Transactions to classify (JSON array):
${JSON.stringify(items.map((i) => ({ id: i.id, description: i.description, amount: i.amount })))}

Respond with ONLY a JSON array (no markdown, no explanation) matching this schema:
[{ "id": "<same id>", "category": "<category from list>", "allowability": "allowable" | "not-allowable" }]`;

  try {
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 1500,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";

    // Strip markdown code fences if the model wrapped output
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();

    let parsed: OutputItem[];
    try {
      parsed = JSON.parse(cleaned) as OutputItem[];
    } catch {
      // Parse failure — return safe fallback
      return NextResponse.json({
        results: items.map((item) => ({
          id:           item.id,
          category:     "Other",
          allowability: "review" as const,
        })),
      });
    }

    // Validate and sanitise each result
    const validCategories = new Set<string>(HMRC_CATEGORIES);
    const results: OutputItem[] = parsed.map((r) => ({
      id:           r.id,
      category:     validCategories.has(r.category) ? r.category : "Other",
      allowability: r.allowability === "not-allowable" ? "not-allowable" : "allowable",
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[expenses/classify] OpenAI error:", err);
    return NextResponse.json(
      { error: "AI classification failed" },
      { status: 500 },
    );
  }
}
