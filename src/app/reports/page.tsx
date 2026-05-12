import { ReportsContent } from "@/components/reports-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports",
  description: "Did the chasing actually work? See what's recovering, what's slipping, and where time goes.",
};

export default function ReportsPage() {
  return <ReportsContent />;
}
