/**
 * Companies House lookup — UK public company data.
 *
 * Free public API. Sign up for a key at:
 *   https://developer.company-information.service.gov.uk/
 *
 * Set COMPANIES_HOUSE_API_KEY in your .env.local to enable.
 *
 * Auth: HTTP Basic with API key as username, blank password.
 *
 * This module is server-only (uses Node fetch, requires a secret env var).
 * Do NOT import it from a "use client" file.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CompanyMatch {
  /** Company number — 8 digit identifier. */
  companyNumber: string;
  /** Registered company name (may differ from trading name). */
  companyName:   string;
  /** "active" | "dissolved" | "liquidation" | "administration" | etc. */
  companyStatus: string;
  /** "ltd" | "llp" | "plc" | "private-limited-guarant-nsc" | etc. */
  companyType:   string;
  /** YYYY-MM-DD. */
  dateOfCreation?: string;
  /** YYYY-MM-DD if dissolved. */
  dateOfCessation?: string;
  /** Registered office address as a single string. */
  address?:      string;
}

export type CompanyRiskFlag =
  | "active"
  | "dissolved"
  | "liquidation"
  | "administration"
  | "voluntary_arrangement"
  | "receivership"
  | "converted_closed"
  | "unknown";

export interface CompanyRiskAssessment {
  flag:     CompanyRiskFlag;
  /** Human-readable summary. */
  summary:  string;
  /** True if the user should NOT extend further credit / chase aggressively. */
  shouldWarn: boolean;
}

export interface CompanyLookupResult {
  match:        CompanyMatch | null;
  /** All matches when more than one company has a similar name (top 5). */
  alternatives: CompanyMatch[];
  risk:         CompanyRiskAssessment | null;
  /** True when the API key is missing — UI should show a setup prompt. */
  notConfigured: boolean;
  /** True if the lookup hit the API but returned no match. */
  noMatch:       boolean;
  /** True if the API call itself failed. */
  apiError:      boolean;
}

// ── API call ──────────────────────────────────────────────────────────────────

const SEARCH_URL = "https://api.company-information.service.gov.uk/search/companies";

interface CompaniesHouseSearchResponse {
  items?: Array<{
    company_number: string;
    title:          string;
    company_status: string;
    company_type:   string;
    date_of_creation?: string;
    date_of_cessation?: string;
    address_snippet?: string;
  }>;
  total_results?: number;
}

/**
 * Look up a UK company by name. Returns the best match (highest similarity to
 * the query) plus up to 4 alternatives. When the API key is missing, returns
 * `notConfigured: true` so the UI can show a setup prompt without breaking.
 */
export async function lookupCompany(name: string): Promise<CompanyLookupResult> {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return {
      match: null,
      alternatives: [],
      risk: null,
      notConfigured: true,
      noMatch: false,
      apiError: false,
    };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return {
      match: null,
      alternatives: [],
      risk: null,
      notConfigured: false,
      noMatch: true,
      apiError: false,
    };
  }

  const url = `${SEARCH_URL}?q=${encodeURIComponent(trimmed)}&items_per_page=5`;
  // Companies House uses HTTP Basic auth: API key as username, blank password.
  const auth = Buffer.from(`${apiKey}:`).toString("base64");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      // Cache responses for 24h — company status doesn't change often.
      next: { revalidate: 86_400 },
    });
  } catch {
    return {
      match: null,
      alternatives: [],
      risk: null,
      notConfigured: false,
      noMatch: false,
      apiError: true,
    };
  }

  if (!response.ok) {
    return {
      match: null,
      alternatives: [],
      risk: null,
      notConfigured: false,
      noMatch: false,
      apiError: true,
    };
  }

  const data = (await response.json()) as CompaniesHouseSearchResponse;
  const items = data.items ?? [];
  if (items.length === 0) {
    return {
      match: null,
      alternatives: [],
      risk: null,
      notConfigured: false,
      noMatch: true,
      apiError: false,
    };
  }

  const allMatches: CompanyMatch[] = items.map((item) => ({
    companyNumber: item.company_number,
    companyName:   item.title,
    companyStatus: item.company_status,
    companyType:   item.company_type,
    dateOfCreation:  item.date_of_creation,
    dateOfCessation: item.date_of_cessation,
    address:       item.address_snippet,
  }));

  const [match, ...alternatives] = allMatches;
  return {
    match,
    alternatives: alternatives.slice(0, 4),
    risk: assessRisk(match),
    notConfigured: false,
    noMatch: false,
    apiError: false,
  };
}

// ── Risk assessment ───────────────────────────────────────────────────────────

/**
 * Convert a company status string into a risk flag with plain-English summary.
 * Conservative — anything other than "active" raises a warning.
 */
export function assessRisk(match: CompanyMatch | null): CompanyRiskAssessment | null {
  if (!match) return null;
  const status = (match.companyStatus ?? "").toLowerCase();

  if (status === "active") {
    return {
      flag: "active",
      summary: "Company is active on Companies House.",
      shouldWarn: false,
    };
  }
  if (status === "dissolved") {
    return {
      flag: "dissolved",
      summary: match.dateOfCessation
        ? `Company was dissolved on ${match.dateOfCessation}. Pursuing the debt may require legal advice.`
        : "Company has been dissolved. Pursuing the debt may require legal advice.",
      shouldWarn: true,
    };
  }
  if (status === "liquidation") {
    return {
      flag: "liquidation",
      summary: "Company is in liquidation. Contact the appointed liquidator before chasing.",
      shouldWarn: true,
    };
  }
  if (status === "administration") {
    return {
      flag: "administration",
      summary: "Company is in administration. Pause direct chasing — register your claim with the administrators.",
      shouldWarn: true,
    };
  }
  if (status === "voluntary-arrangement") {
    return {
      flag: "voluntary_arrangement",
      summary: "Company is in a Company Voluntary Arrangement (CVA). Payment terms may be agreed via the CVA supervisor.",
      shouldWarn: true,
    };
  }
  if (status === "receivership") {
    return {
      flag: "receivership",
      summary: "Company is in receivership. Direct collection is unlikely to succeed.",
      shouldWarn: true,
    };
  }
  if (status === "converted-closed") {
    return {
      flag: "converted_closed",
      summary: "Company has been converted/closed. Verify if a successor entity owes the debt.",
      shouldWarn: true,
    };
  }

  return {
    flag: "unknown",
    summary: `Status reported as "${match.companyStatus}". Review Companies House directly before chasing.`,
    shouldWarn: true,
  };
}
