import Link from "next/link";
import {
  LandingHero,
  WhatItAnswers,
  HowItWorks,
  BuiltForMessyAR,
  BookkeeperSection,
  SafetySection,
  FinalCTA,
} from "@/components/landing-hero";
import { PricingSection } from "@/components/pricing-cards";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fbf8f1] text-neutral-950">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#fbf8f1]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-950 text-base font-bold text-white">
              Z
            </span>
            <span className="leading-tight">
              <span className="block tracking-[0.18em]">ZENTRA</span>
              <span className="block text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Collect
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-600 md:flex">
            <Link href="#how-it-works" className="transition-colors hover:text-neutral-950">
              How it works
            </Link>
            <Link href="#pricing" className="transition-colors hover:text-neutral-950">
              Pricing
            </Link>
            <Link href="/dashboard" className="transition-colors hover:text-neutral-950">
              Demo
            </Link>
          </nav>

          <Link
            href="/request-access"
            className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Request access
          </Link>
        </div>
      </header>

      <main>
        <LandingHero />
        <WhatItAnswers />
        <HowItWorks />
        <BuiltForMessyAR />
        <BookkeeperSection />
        <SafetySection />
        <PricingSection />
        <FinalCTA />
      </main>

      <footer className="border-t border-black/10">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-lg bg-neutral-950 text-xs font-bold text-white">
                Z
              </span>
              <span className="text-sm font-medium text-neutral-950">Zentra Collect</span>
            </div>
            <p className="max-w-md text-xs text-neutral-400">
              Zentra Collect supports credit-control workflow and decision-making. It does not provide legal, accounting, or tax advice. All messages require human review before sending.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
