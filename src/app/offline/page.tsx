import Link from "next/link";
import { WifiOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're offline",
  description: "Zentra Collect is offline. We'll reload your data when you're back online.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 text-center"
         style={{ background: "var(--zn-bg)", color: "var(--zn-ink)",
                  paddingTop: "max(2.5rem, env(safe-area-inset-top))",
                  paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
      <div
        className="size-14 rounded-full flex items-center justify-center mb-5"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        <WifiOff className="size-6" style={{ color: "var(--zn-ink-3)" }} />
      </div>
      <h1 className="text-[22px] font-semibold mb-2">You&rsquo;re offline</h1>
      <p className="text-[14px] leading-6 max-w-sm" style={{ color: "var(--zn-ink-3)" }}>
        Zentra Collect needs a connection to load your invoices. Reconnect to your network
        and we&rsquo;ll pick up where you left off.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center mt-6 px-5 py-2.5 rounded-full text-[13.5px] font-semibold"
        style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
      >
        Try again
      </Link>
    </div>
  );
}
