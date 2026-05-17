import TaxPageClient from "@/components/tax-page-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title:       "Tax",
  description: "Estimate your Self Assessment tax owed and how much to set aside.",
};

export default function TaxPage() {
  return <TaxPageClient />;
}
