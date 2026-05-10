import { Suspense } from "react";
import { DemoAuthForm } from "@/components/demo-auth-form";

// Suspense boundary required because DemoAuthForm uses useSearchParams()
// to read ?mode=signin/signup. Without it, Next.js fails to prerender.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <DemoAuthForm />
    </Suspense>
  );
}
