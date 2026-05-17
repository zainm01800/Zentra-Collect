import { BillsClient } from "@/components/bills-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bills",
  description: "Track what your business owes — supplier invoices and recurring costs.",
};

export default function BillsPage() {
  return <BillsClient />;
}
