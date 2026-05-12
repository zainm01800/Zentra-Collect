import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Get started · Zentra Flow",
  description: "Set up your Zentra Flow workspace in minutes.",
};

export default async function OnboardingPage() {
  // If Supabase is configured and the user already has an account row,
  // skip onboarding and take them straight to their dashboard.
  if (hasSupabaseServerConfig()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: member } = await supabase
        .from("zentra_account_members")
        .select("account_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (member) {
        redirect("/dashboard");
      }
    }
  }

  return <OnboardingFlow />;
}
