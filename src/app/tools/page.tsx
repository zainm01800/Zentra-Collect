import Link from "next/link";
import { Calculator, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tools",
  description: "Free tools for UK credit control — late payment interest calculator and more.",
};

const TOOLS = [
  {
    href: "/tools/late-payment-interest",
    icon: Calculator,
    title: "Late payment interest calculator",
    desc: "Calculate UK statutory interest (BoE base + 8%) and fixed compensation under the Late Payment of Commercial Debts Act 1998.",
    badge: "B2B only",
  },
];

export default function ToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker="Free tools"
        title="Credit control tools"
        sub="Practical calculators and references for UK B2B collections."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex flex-col gap-3 rounded-2xl p-5 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
              style={{ border: "1px solid var(--zn-line-soft)", background: "var(--zn-surface)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="size-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--zn-bg-2)" }}
                >
                  <Icon className="size-4" style={{ color: "var(--zn-accent)" }} />
                </div>
                {tool.badge && (
                  <span
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)", border: "1px solid var(--zn-line-soft)" }}
                  >
                    {tool.badge}
                  </span>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-[14px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">
                  {tool.title} <ArrowRight className="size-3.5 flex-shrink-0" style={{ color: "var(--zn-ink-3)" }} />
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--zn-ink-3)" }}>
                  {tool.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
