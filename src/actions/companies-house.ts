"use server";

/**
 * Server action wrapper for the Companies House lookup.
 * Safe to call from client components — keeps the API key server-side.
 */

import { lookupCompany, type CompanyLookupResult } from "@/lib/companies-house";

/**
 * Look up a UK company by name.
 *
 * Always resolves to a CompanyLookupResult — never throws. The result's
 * flags (`notConfigured`, `noMatch`, `apiError`) tell the UI what to render.
 */
export async function lookupCompanyAction(name: string): Promise<CompanyLookupResult> {
  return lookupCompany(name);
}
