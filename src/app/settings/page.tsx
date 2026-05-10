import { AccountPlanSettings } from "@/components/account-plan-settings";
import { SettingsForm } from "@/components/settings-form";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Tone defaults, integrations, plan, and account preferences.",
};

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <AccountPlanSettings />
      <SettingsForm />
    </div>
  );
}
