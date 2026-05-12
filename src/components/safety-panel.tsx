import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { SafetyCheckResult, SafetyStatus } from "@/types/zentra";

function overallStatus(checks: SafetyCheckResult[]): SafetyStatus {
  if (checks.some((c) => c.status === "blocked")) return "blocked";
  if (checks.some((c) => c.status === "needs_review")) return "needs_review";
  return "safe_to_draft";
}

const statusConfig = {
  blocked: {
    label: "Blocked",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
    Icon: XCircle,
  },
  needs_review: {
    label: "Review required",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    Icon: AlertTriangle,
  },
  safe_to_draft: {
    label: "Safe to draft",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: ShieldCheck,
  },
} as const;

const checkConfig = {
  blocked: {
    Icon: XCircle,
    iconClass: "text-red-500",
    rowClass: "border-red-100 bg-red-50/50",
  },
  needs_review: {
    Icon: AlertTriangle,
    iconClass: "text-amber-500",
    rowClass: "border-amber-100 bg-amber-50/50",
  },
  safe_to_draft: {
    Icon: CheckCircle2,
    iconClass: "text-emerald-500",
    rowClass: "border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17]",
  },
} as const;

export function SafetyPanel({
  checks,
  selectedTone,
}: {
  checks: SafetyCheckResult[];
  selectedTone?: string;
}) {
  const status = overallStatus(checks);
  const { label, badgeClass, Icon } = statusConfig[status];

  return (
    <section className="rounded-2xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8d8472] dark:text-[#6a5f4e]">
          Safety checks
        </p>
        <Badge variant="outline" className={`rounded-full ${badgeClass}`}>
          <Icon className="mr-1 size-3" />
          {label}
        </Badge>
      </div>

      <ol className="mt-3 space-y-2">
        {checks.length ? (
          checks.map((check) => {
            const { Icon: CheckIcon, iconClass, rowClass } = checkConfig[check.status];
            return (
              <li
                key={check.id}
                className={`flex gap-3 rounded-xl border p-3 ${rowClass}`}
              >
                <CheckIcon className={`mt-0.5 size-4 shrink-0 ${iconClass}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1d1813] dark:text-[#f0e8d5]">{check.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#6b6253] dark:text-[#8a7d69]">
                    {check.explanation}
                  </p>
                </div>
              </li>
            );
          })
        ) : (
          <li className="flex items-center gap-2 rounded-xl border border-[#d4c9ae] dark:border-[#2d2820] bg-[#faf5e8] dark:bg-[#211d17] p-3 text-sm text-emerald-700">
            <CheckCircle2 className="size-4 text-emerald-500" />
            No safety issues found. Safe to draft.
          </li>
        )}
      </ol>

      {selectedTone === "final" ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
          <span className="font-semibold">Final notice tone selected.</span> This
          message may have legal or relationship implications. Confirm with your
          manager before sending.
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-[#a09885] dark:text-[#8a7d69]">
        Zentra drafts and recommends. You are responsible for reviewing messages
        before sending.
      </p>
    </section>
  );
}
