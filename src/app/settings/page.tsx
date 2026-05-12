import { SettingsForm } from "@/components/settings-form";
import { AddonSuccessBanner } from "@/components/addon-success-banner";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Tone defaults, integrations, plan, and account preferences.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <AddonSuccessBanner addonSuccess={params.addon_success} />
      <SettingsForm defaultTab={params.tab} />
    </div>
  );
}
