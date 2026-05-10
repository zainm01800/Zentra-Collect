import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DashboardStats } from "@/components/dashboard-stats";
import { ChaseQueue } from "@/components/chase-queue";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { TodayPlan } from "@/components/today-plan";
import { SyncStatus } from "@/components/sync-status";
import type { Invoice } from "@/types/cashpilot";

export function DashboardView({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="space-y-8">
      <DemoModeBanner />

      {/* Hero header */}
      <div className="flex flex-col gap-4 border-b border-[#d4c9ae] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-[#6b6253]"
            style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
          >
            Daily credit-control workspace
          </p>
          <h1
            className="mt-3 max-w-2xl text-[32px] leading-[1.2] text-[#1d1813] sm:text-[38px]"
            style={{
              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
              fontWeight: 500,
              letterSpacing: "-0.015em",
            }}
          >
            Collections queue
          </h1>
          <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-[#6b6253]">
            Your ranked chase plan. Each row has a recommended action, the
            reason behind it, and a Review step before anything goes out.
          </p>
        </div>
        <Link
          href="/chase-today"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[#1d1813] px-5 text-[13px] font-medium text-[#faf5e8] hover:opacity-90 transition-opacity flex-shrink-0"
        >
          Open queue
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Today's plan */}
      <TodayPlan invoices={invoices} />

      {/* Cash position */}
      <section className="space-y-4">
        <div>
          <h2
            className="text-[22px] text-[#1d1813]"
            style={{
              fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            Cash position
          </h2>
          <p className="mt-1 text-[13.5px] text-[#6b6253]">
            The numbers that decide whether today is a quick reminder day or an
            escalation day.
          </p>
        </div>
        <DashboardStats invoices={invoices} />
      </section>

      <SyncStatus />
      <ChaseQueue initialInvoices={invoices} />
    </div>
  );
}
