import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found · Zentra Flow",
  description: "The page you're looking for doesn't exist.",
};

export default function NotFound() {
  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 relative z-[1]"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      <div className="zn-card max-w-[460px] w-full p-8 text-center">
        <div
          className="size-12 mx-auto rounded-lg inline-flex items-center justify-center mb-4"
          style={{
            background: "var(--zn-ink)",
            color: "var(--zn-surface)",
            fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 22,
          }}
        >
          Z
        </div>
        <div className="zn-label !p-0 mb-2">404 · not found</div>
        <h1
          className="text-[28px] sm:text-[32px] tracking-[-0.015em] leading-[1.1] text-[#1d1813] dark:text-[#f0e8d5]"
          style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
        >
          This page isn&apos;t in your workspace.
        </h1>
        <p className="mt-3 text-[13.5px] leading-[1.6]" style={{ color: "var(--zn-ink-3)" }}>
          The page or invoice you opened doesn&apos;t exist here. It may have
          been deleted, moved, or never created.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href="/dashboard" className="zn-pill">
            Back to dashboard <ArrowRight className="size-3.5" />
          </Link>
          <Link href="/" className="zn-pill zn-pill-ghost">
            Homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
