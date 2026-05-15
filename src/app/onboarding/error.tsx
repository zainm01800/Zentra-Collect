"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function OnboardingError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error("[onboarding] boundary caught:", error); }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--zn-bg)" }}>
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="size-12 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--zn-risk-soft)" }}>
          <AlertTriangle className="size-5" style={{ color: "var(--zn-risk)" }} />
        </div>
        <div>
          <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Onboarding couldn&apos;t load
          </p>
          <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
            Something went wrong setting up your account. Please sign in again.
          </p>
        </div>
        <Link href="/login" className="zn-pill text-[13px]">Back to sign in</Link>
      </div>
    </div>
  );
}
