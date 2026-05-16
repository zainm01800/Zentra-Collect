"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "#how-it-works",  label: "How it works" },
  { href: "#why-zentra",    label: "Why Zentra" },
  { href: "#bookkeepers",   label: "For bookkeepers" },
  { href: "/free-tools",    label: "Free tools" },
  { href: "#pricing",       label: "Pricing" },
  { href: "#faq",           label: "FAQ" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur border-b bg-[rgba(233,223,201,0.88)] dark:bg-[rgba(33,29,23,0.88)]"
      style={{ borderColor: "var(--zn-line)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="zn-brand-mark">Z</span>
          <span className="flex flex-col leading-[1.1]">
            <span className="text-[14px] font-semibold tracking-[-0.01em]">Zentra</span>
            <span className="zn-section-label !p-0 !mt-0.5">Collect</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7 text-[13px] font-medium text-[#3d3428] dark:text-[#d8ccb5]">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[#1d1813] dark:hover:text-[#f0e8d5] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link href="/login?mode=signin" className="zn-pill zn-pill-ghost hidden sm:inline-flex">Sign in</Link>
          <Link href="/demo" target="_blank" rel="noopener noreferrer" className="zn-pill">Try the demo</Link>
          {/* Hamburger — mobile only */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-[#e0d6bd] dark:hover:bg-[#28231c]"
            style={{ color: "var(--zn-ink)" }}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          className="md:hidden border-t"
          style={{ background: "var(--zn-bg)", borderColor: "var(--zn-line)" }}
        >
          <nav className="flex flex-col px-4 py-4 gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors hover:bg-[#e0d6bd] dark:hover:bg-[#28231c]"
                style={{ color: "var(--zn-ink-2)" }}
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
              <Link href="/login?mode=signin" className="zn-pill zn-pill-ghost w-full justify-center">
                Sign in
              </Link>
              <Link href="/demo" target="_blank" rel="noopener noreferrer" className="zn-pill w-full justify-center">
                Try the demo
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
