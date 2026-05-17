/**
 * GET /api/companies-house?name=Acme+Ltd
 * GET /api/companies-house?number=12345678
 *
 * Proxies Companies House API requests server-side to protect the API key
 * and avoid CORS issues. Returns a simplified company profile.
 *
 * Requires: COMPANIES_HOUSE_API_KEY env var.
 * Without a key, uses the public search endpoint (rate-limited, no auth).
 */

import { NextRequest, NextResponse } from "next/server";

const CH_BASE = "https://api.company-information.service.gov.uk";

interface CHCompany {
  company_number: string;
  company_name: string;
  company_status: string;
  company_type: string;
  date_of_creation?: string;
  date_of_cessation?: string;
  registered_office_address?: {
    address_line_1?: string;
    address_line_2?: string;
    locality?: string;
    postal_code?: string;
    country?: string;
  };
  accounts?: {
    next_due?: string;
    last_accounts?: {
      made_up_to?: string;
      type?: string;
    };
    overdue?: boolean;
  };
  sic_codes?: string[];
}

interface CHSearchResult {
  items?: CHCompany[];
  total_results?: number;
}

function authHeaders(): Record<string, string> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) return {};
  const encoded = Buffer.from(`${key}:`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

function simplify(c: CHCompany) {
  return {
    number: c.company_number,
    name: c.company_name,
    status: c.company_status,            // "active" | "dissolved" | "liquidation" etc.
    type: c.company_type,
    incorporatedOn: c.date_of_creation,
    dissolvedOn: c.date_of_cessation,
    address: c.registered_office_address
      ? [
          c.registered_office_address.address_line_1,
          c.registered_office_address.address_line_2,
          c.registered_office_address.locality,
          c.registered_office_address.postal_code,
        ]
          .filter(Boolean)
          .join(", ")
      : null,
    accountsDue: c.accounts?.next_due,
    lastAccountsMadeUpTo: c.accounts?.last_accounts?.made_up_to,
    accountsOverdue: c.accounts?.overdue ?? false,
    sicCodes: c.sic_codes ?? [],
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const number = searchParams.get("number");

  if (!name && !number) {
    return NextResponse.json({ error: "Provide ?name= or ?number=" }, { status: 400 });
  }

  try {
    if (number) {
      // Direct company lookup by number
      const res = await fetch(`${CH_BASE}/company/${encodeURIComponent(number)}`, {
        headers: authHeaders(),
        next: { revalidate: 3600 },
      });
      if (!res.ok) {
        if (res.status === 404) return NextResponse.json({ company: null });
        return NextResponse.json({ error: `CH API returned ${res.status}` }, { status: 502 });
      }
      const company: CHCompany = await res.json();
      return NextResponse.json({ company: simplify(company) });
    }

    // Search by name — return top 5
    const res = await fetch(
      `${CH_BASE}/search/companies?q=${encodeURIComponent(name!)}&items_per_page=5`,
      {
        headers: authHeaders(),
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: `CH API returned ${res.status}` }, { status: 502 });
    }
    const data: CHSearchResult = await res.json();
    const results = (data.items ?? []).map(simplify);
    return NextResponse.json({ results, total: data.total_results ?? 0 });
  } catch (err) {
    console.error("[companies-house]", err);
    return NextResponse.json({ error: "Company lookup failed." }, { status: 500 });
  }
}
