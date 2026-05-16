"use client";

/**
 * Direct Debit suppression nudge — surfaces on the chase plan when the
 * user has NOT yet connected GoCardless and hasn't dismissed it.
 *
 * Why this exists: GoCardless connection is the single biggest workflow
 * improvement Zentra offers (customers on DD get automatically removed
 * from the chase plan). But it's a one-click setting most users will
 * never discover without prompting.
 */

import { useEffect, useState } from "react";
import { Zap, X } from "lucide-react";
import { readDirectDebitEmails } from "@/lib/collections/dd-cache";

const DISMISS_KEY = "zn:dd-nudge-dismissed:v1";

export function DirectDebitNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;
    // If the user has already synced DD emails, they're already using
    // the feature — no nudge needed.
    const emails = readDirectDebitEmails();
    if (emails.size > 0) return;
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setShow(false);
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
      style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Zap className="size-4 shrink-0" style={{ color: "var(--zn-safe)" }} />
        <p className="text-[12.5px] leading-5" style={{ color: "var(--zn-ink-2)" }}>
          <strong>Stop chasing customers on Direct Debit.</strong>{" "}
          Connect GoCardless and any customer on an active mandate is removed from this list automatically.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href="/settings/integrations"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold"
          style={{ background: "var(--zn-safe)", color: "white" }}
        >
          Connect →
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 rounded hover:bg-black/5"
        >
          <X className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </button>
      </div>
    </div>
  );
}
