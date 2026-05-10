"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import {
  consumePromotionEvent,
  getQueueCounts,
  type PromotionEvent,
  type QueueCounts,
} from "@/lib/collections/queue-engine";

// Shown only when waiting invoices exist. Displays the active/waiting split
// and a one-time notice when a waiting invoice is promoted into the active queue.
export function QueueStatusBar() {
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [promotion, setPromotion] = useState<PromotionEvent | null>(null);

  useEffect(() => {
    const refresh = () => {
      setCounts(getQueueCounts());
      // Consume any pending promotion event (clears it from localStorage)
      const event = consumePromotionEvent();
      if (event) setPromotion(event);
    };

    refresh();

    // Re-read counts whenever localStorage changes (e.g. after freeSlot in another
    // part of the UI writes back). This keeps the bar in sync without polling.
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  // Dismiss promotion notice after 6 seconds
  useEffect(() => {
    if (!promotion) return;
    const t = window.setTimeout(() => setPromotion(null), 6000);
    return () => window.clearTimeout(t);
  }, [promotion]);

  if (!counts || counts.waiting === 0) return null;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-[10px] px-4 py-2.5 mb-4"
      style={{
        background: "var(--zn-surface)",
        border: "1px solid var(--zn-line)",
      }}
    >
      {/* Main status line */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="size-1.5 rounded-full flex-shrink-0"
          style={{ background: "var(--zn-warn)" }}
        />
        <span className="text-[12.5px]" style={{ color: "var(--zn-ink-2)" }}>
          <span className="font-semibold">{counts.active}</span>{" "}
          invoice{counts.active === 1 ? "" : "s"} active
          <span className="mx-1.5" style={{ color: "var(--zn-line)" }}>·</span>
          <span className="font-semibold">{counts.waiting}</span>{" "}
          waiting
          <span className="mx-1.5" style={{ color: "var(--zn-line)" }}>·</span>
          <span style={{ color: "var(--zn-ink-3)" }}>
            Resolve an invoice to free a slot
          </span>
        </span>
      </div>

      {/* Promotion notice — shown once when a waiting invoice is promoted */}
      {promotion ? (
        <div
          className="flex items-center gap-2 text-[11.5px]"
          style={{ color: "var(--zn-ink-2)" }}
        >
          <ArrowUp
            className="size-3 flex-shrink-0"
            style={{ color: "var(--zn-safe)" }}
          />
          <span>
            <span className="font-semibold">{promotion.customerName}</span>
            {" "}·{" "}
            {promotion.invoiceNumber}
            {" "}({formatCurrency(promotion.amountOutstanding)}){" "}
            promoted to active queue
          </span>
        </div>
      ) : null}
    </div>
  );
}
