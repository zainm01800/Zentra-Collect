/**
 * Shared layout for /terms, /privacy, /cookies. Keeps the marketing chrome
 * (top bar + footer) and gives every legal page a consistent feel.
 */

import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  kicker,
  title,
  lastUpdated,
  children,
}: {
  kicker: string;
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <main
      className="min-h-screen relative z-[1]"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      {/* Top bar — mirrors the marketing site so the page feels like part of zentracollect.co.uk */}
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: "rgba(233,223,201,0.85)",
          borderBottom: "1px solid var(--zn-line)",
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="zn-brand-mark">Z</span>
            <span className="flex flex-col leading-[1.1]">
              <span className="text-[14px] font-semibold tracking-[-0.01em]">Zentra</span>
              <span className="zn-section-label !p-0 !mt-0.5">Collect</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-[13px] underline-offset-2 hover:underline"
            style={{ color: "var(--zn-ink-3)" }}
          >
            ← Back to homepage
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="zn-label !p-0 mb-2">{kicker}</div>
        <h1
          className="text-[36px] sm:text-[44px] tracking-[-0.015em] leading-[1.05] text-[#1d1813]"
          style={{
            fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
            fontWeight: 500,
          }}
        >
          {title}
        </h1>
        <p
          className="mt-3 text-[12.5px]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Last updated: {lastUpdated}
        </p>

        <div
          className="mt-8 flex flex-col gap-5 text-[14.5px] leading-[1.7]"
          style={{ color: "var(--zn-ink-2)" }}
        >
          {children}
        </div>

        <div
          className="mt-12 rounded-[12px] p-4 text-[12.5px]"
          style={{
            background: "var(--zn-warn-soft)",
            color: "var(--zn-warn)",
            border: "1px solid var(--zn-warn-soft)",
          }}
        >
          <strong>Draft notice:</strong> This page is a starting template, not
          legal advice. Have a UK-qualified solicitor review the wording before
          you accept your first paying customer.
        </div>
      </article>

      <footer
        className="border-t mt-4"
        style={{ borderColor: "var(--zn-line)" }}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="zn-brand-mark" style={{ width: 24, height: 24, fontSize: 13 }}>Z</span>
            <span className="text-[13px] font-medium text-[#1d1813]">Zentra Collect</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
            <Link href="/terms"   className="hover:text-[#1d1813]">Terms</Link>
            <Link href="/privacy" className="hover:text-[#1d1813]">Privacy</Link>
            <Link href="/cookies" className="hover:text-[#1d1813]">Cookies</Link>
            <Link href="/help"    className="hover:text-[#1d1813]">Help</Link>
            <span>© {new Date().getFullYear()} Zentra</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
