import { PLClient } from "@/components/pl-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profit & Loss",
  description: "Income vs allowable expenses — net profit for the current UK tax year.",
};

export default function PLPage() {
  return <PLClient />;
}
