import type { Metadata } from "next";
import { Suspense } from "react";
import { DemoAuthForm } from "@/components/demo-auth-form";

export const metadata: Metadata = {
  title: "Sign in · Zentra Collect",
  description: "Sign in to your Zentra Collect account or start a free trial.",
};

// Suspense boundary required because DemoAuthForm uses useSearchParams()
// to read ?mode=signin/signup. Without it, Next.js fails to prerender.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <DemoAuthForm />
    </Suspense>
  );
}
