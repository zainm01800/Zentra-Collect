/**
 * src/lib/expense-allowability.ts
 *
 * HMRC-informed heuristics for auto-classifying bank transaction descriptions
 * as allowable business expenses or personal/non-business spend.
 *
 * Allowability is probabilistic — the user can override any classification
 * with a single tap in the Expenses UI.
 *
 * UK HMRC reference: https://www.gov.uk/expenses-if-youre-self-employed
 */

export type Allowability = "allowable" | "not-allowable" | "review";

export interface ClassifyResult {
  category: string;
  allowability: Allowability;
}

/**
 * Substrings in a transaction description that strongly indicate
 * personal / non-allowable spend. Checked before allowable rules.
 */
const NOT_ALLOWABLE_KEYWORDS: string[] = [
  // Streaming / entertainment subscriptions
  "netflix", "spotify", "apple music", "disney+", "now tv", "paramount+",
  "sky tv", "amazon prime video", "prime video",
  // Grocery supermarkets (personal food — not client entertainment)
  "tesco", "sainsbury", "asda", "morrisons", "waitrose", "aldi", "lidl",
  "co-op food", "marks & spencer food", "m&s food", "iceland food",
  "farmfoods", "budgens", "costco",
  // Gyms / leisure
  "puregym", "david lloyd", "virgin active", "nuffield health",
  "the gym group", "anytime fitness",
  // Fast food / coffee (personal meals)
  "mcdonald", "burger king", "five guys", "kfc ",
  "greggs", "subway sandwi", "pizza hut", "dominos", "papa john",
  // Fashion retail
  "asos", "primark", "boohoo", "river island", "new look",
  "pretty little thing", "shein",
  // Personal entertainment
  "ticketmaster", "vue cinema", "odeon cinemas", "cineworld",
  // Personal digital purchases
  "itunes", "steam games", "playstation store", "xbox game",
  // Personal travel / accommodation
  "airbnb", "booking.com", "hotels.com", "trivago",
];

/**
 * Substrings that indicate a specific HMRC allowable expense category.
 * Evaluated in order — first match wins.
 */
const ALLOWABLE_RULES: Array<{ keywords: string[]; category: string }> = [
  {
    // Cloud infrastructure & hosting
    keywords: [
      "github", "vercel", "netlify", "amazon web services", "aws.", "cloudflare",
      "digitalocean", "railway.app", "supabase", "heroku", "linode", "hetzner",
      "fly.io", "render.com",
    ],
    category: "Equipment & software",
  },
  {
    // SaaS / productivity tools
    keywords: [
      "adobe", "figma", "notion.so", "slack", "dropbox", "google workspace",
      "microsoft 365", "office 365", "atlassian", "jira", "trello", "asana",
      "linear.app", "canva", "loom", "zoom.us", "typeform",
    ],
    category: "Equipment & software",
  },
  {
    // Marketing / email / CRM / accounting SaaS
    keywords: [
      "mailchimp", "hubspot", "sendgrid", "brevo", "twilio", "xero",
      "quickbooks", "freeagent", "sage business", "clearbooks",
    ],
    category: "Equipment & software",
  },
  {
    // Business mobile / broadband
    keywords: [
      "vodafone business", "o2 business", "bt business", "virgin media business",
      "three business", "ee business", "talktalk business",
    ],
    category: "Phone & internet",
  },
  {
    // Public transport (UK rail & TfL)
    keywords: [
      "tfl journey", "transport for london", "trainline", "national rail",
      "avanti", "gwr ", "lner.", "southeastern", "thameslink", "crossrail",
      "scotrail", "transpennine",
    ],
    category: "Travel & mileage",
  },
  {
    // Taxis & ride-hailing
    keywords: ["uber trip", "bolt trip", "addison lee", "free now", "kapten"],
    category: "Travel & mileage",
  },
  {
    // Flights (business travel)
    keywords: ["british airways", "easyjet", "ryanair", "jet2 ", "eurostar"],
    category: "Travel & mileage",
  },
  {
    // Office supplies
    keywords: [
      "ryman stationery", "staples", "office depot", "wh smith",
      "whsmith", "viking direct",
    ],
    category: "Office & stationery",
  },
  {
    // Training & CPD
    keywords: [
      "udemy", "coursera", "linkedin learning", "pluralsight",
      "skillshare", "futurelearn",
    ],
    category: "Training & development",
  },
  {
    // Digital advertising
    keywords: [
      "facebook ads", "google ads", "meta ads", "linkedin ads",
      "twitter ads", "tiktok for business",
    ],
    category: "Marketing & advertising",
  },
  {
    // Bank / payment charges
    keywords: [
      "bank charge", "account fee", "overdraft fee", "transaction fee",
      "stripe fee", "paypal fee",
    ],
    category: "Bank charges",
  },
  {
    // Office rent & utilities
    keywords: [
      "regus", "wework", "flexible workspace", "office rent",
      "electricity", "gas bill", "water rates", "utility bill",
      "bt broadband business", "virgin media business",
    ],
    category: "Premises & utilities",
  },
];

/**
 * Given a bank transaction description, return the best-guess HMRC expense
 * category and allowability status.
 */
export function classifyExpense(description: string): ClassifyResult {
  const lower = description.toLowerCase();

  for (const kw of NOT_ALLOWABLE_KEYWORDS) {
    if (lower.includes(kw)) {
      return { category: "Other", allowability: "not-allowable" };
    }
  }

  for (const { keywords, category } of ALLOWABLE_RULES) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return { category, allowability: "allowable" };
    }
  }

  return { category: "Other", allowability: "review" };
}

/** Human-readable label for an allowability value. */
export function allowabilityLabel(a: Allowability): string {
  if (a === "allowable")     return "Allowable";
  if (a === "not-allowable") return "Not allowable";
  return "Review";
}

/** CSS variable references for each allowability state. */
export function allowabilityColors(a: Allowability): {
  bg: string; text: string; border: string;
} {
  if (a === "allowable") {
    return { bg: "var(--zn-safe-soft)", text: "var(--zn-safe)", border: "var(--zn-safe)" };
  }
  if (a === "not-allowable") {
    return { bg: "var(--zn-risk-soft)", text: "var(--zn-risk)", border: "var(--zn-risk)" };
  }
  return { bg: "var(--zn-warn-soft)", text: "var(--zn-warn)", border: "var(--zn-warn)" };
}
