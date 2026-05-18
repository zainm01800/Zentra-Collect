import type { Metadata } from "next";
import { AccountBilling } from "@/components/account-billing";

export const metadata: Metadata = {
  title: "Account & Billing",
  description: "Manage your plan, usage, and billing.",
};

export default function AccountBillingPage() {
  return <AccountBilling />;
}
