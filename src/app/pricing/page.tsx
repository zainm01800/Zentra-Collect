import { redirect } from "next/navigation";

// Pricing now lives in the homepage's #pricing section so the upgrade
// story sits next to the value proposition. Old /pricing links still work.
export default function PricingPage() {
  redirect("/#pricing");
}
