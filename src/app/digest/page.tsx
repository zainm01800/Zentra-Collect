import { ZentraWeeklyDigest } from "@/components/zentra-weekly-digest";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Weekly digest",
  description: "A Monday-ready summary for owners and bookkeepers.",
};

export default function DigestPage() {
  return <ZentraWeeklyDigest />;
}
