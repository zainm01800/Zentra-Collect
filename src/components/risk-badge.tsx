"use client";

/**
 * Risk badge — small visual indicator of a customer's payment risk.
 *
 * Two sizes:
 *   - <RiskBadge size="sm" /> — compact pill for use in tight rows (chase queue)
 *   - <RiskBadge size="md" /> — full pill with label and reason for customer pages
 *
 * Renders nothing if the customer has no open invoices.
 */

import { ShieldAlert, ShieldCheck, AlertOctagon } from "lucide-react";
import type { CustomerRisk, RiskLevel } from "@/lib/risk-score";

interface RiskBadgeProps {
  risk: CustomerRisk;
  size?: "sm" | "md";
}

// Tones use existing Zentra theme tokens.
function toneFor(level: RiskLevel) {
  switch (level) {
    case 1: return { bg: "rgba(70, 132, 90, 0.10)",  fg: "#34794a", icon: ShieldCheck };
    case 2: return { bg: "rgba(110, 110, 110, 0.10)", fg: "#5a5a5a", icon: ShieldCheck };
    case 3: return { bg: "rgba(212, 168, 83, 0.15)",  fg: "#a07522", icon: ShieldAlert };
    case 4: return { bg: "rgba(205, 73, 73, 0.10)",   fg: "#bf3a3a", icon: ShieldAlert };
    case 5: return { bg: "rgba(205, 73, 73, 0.18)",   fg: "#a82424", icon: AlertOctagon };
  }
}

export function RiskBadge({ risk, size = "sm" }: RiskBadgeProps) {
  // No open invoices — don't render
  if (risk.stats.openInvoiceCount === 0) return null;

  const tone = toneFor(risk.level);
  const Icon = tone.icon;

  if (size === "sm") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold tabular-nums"
        style={{ background: tone.bg, color: tone.fg }}
        title={risk.reason}
      >
        <Icon className="size-2.5" />
        {risk.label}
      </span>
    );
  }

  // md: full pill with reason
  return (
    <div
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <Icon className="size-3.5" />
      <div className="flex flex-col leading-tight">
        <span className="text-[11.5px] font-semibold">{risk.label} risk</span>
        <span className="text-[10.5px] opacity-90">{risk.reason}</span>
      </div>
    </div>
  );
}
