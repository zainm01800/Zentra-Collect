import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
  hasSupabaseAdminConfig,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Get started",
  description: "Set up your Zentra Collect workspace in minutes.",
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
      // Use the admin client (service role) so RLS never blocks this check.
      // If the admin client isn't configured, fall back to the anon client.
      const db = hasSupabaseAdminConfig() ? getSupabaseAdminClient() : supabase;
      const { data: member } = await db
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
