import type { Metadata } from "next";
import { MileageClient } from "@/components/mileage-client";

export const metadata: Metadata = {
  title: "Mileage",
  description: "Log business miles for Self-Assessment. HMRC mileage allowance applied automatically.",
};

export default function MileagePage() {
  return <MileageClient />;
}
