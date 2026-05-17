"use client";

/**
 * ReferralCard — bookkeeper flywheel.
 *
 * Lets the user copy a personal referral link and see their invite count.
 * Each accepted invite unlocks +1 extra ledger slot (up to 5 bonus).
 * State is localStorage-only in the MVP; backend can replace it later.
 */

import { useState, useEffect } from "react";
import { Check, Copy, Gift, Users } from "lucide-react";
import { playTick } from "@/lib/sounds";

const REF_KEY = "zentra.referral.v1";
const REF_COUNT_KEY = "zentra.referral.invites.v1";

function getReferralCode(): string {
  if (typeof window === "undefined") return "DEMO";
  let code = localStorage.getItem(REF_KEY);
  if (!code) {
    code = "ZC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    localStorage.setItem(REF_KEY, code);
  }
  return code;
}

export function ReferralCard() {
  const [code, setCode] = useState("ZC-XXXXXX");
  const [invites, setInvites] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCode(getReferralCode());
    setInvites(parseInt(localStorage.getItem(REF_COUNT_KEY) ?? "0", 10));
  }, []);

  const referralUrl = `https://zentracollect.co.uk/join?ref=${code}`;
  const bonusLedgers = Math.min(invites, 5);

  function copyLink() {
    navigator.clipboard?.writeText(referralUrl).catch(() => {});
    playTick();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--zn-surface)",
        border: "1px solid var(--zn-line-soft)",
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="size-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--zn-surface-2)" }}
        >
          <Gift className="size-4" style={{ color: "var(--zn-ink-2)" }} />
        </div>
        <div>
          <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            Invite a colleague
          </p>
          <p className="text-[12.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
            Each colleague who joins Zentra Collect unlocks +1 extra client ledger for you — up to 5 bonus ledgers.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 px-4 py-3 rounded-xl" style={{ background: "var(--zn-surface-2)" }}>
        <div className="flex items-center gap-2">
          <Users className="size-4" style={{ color: "var(--zn-ink-3)" }} />
          <div>
            <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--zn-ink-3)" }}>Invites accepted</p>
            <p className="text-[20px] font-semibold tabular-nums" style={{ color: "var(--zn-ink)" }}>{invites}</p>
          </div>
        </div>
        <div style={{ width: 1, height: 36, background: "var(--zn-line-soft)" }} />
        <div>
          <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--zn-ink-3)" }}>Bonus ledgers earned</p>
          <p className="text-[20px] font-semibold tabular-nums" style={{ color: bonusLedgers > 0 ? "var(--zn-safe)" : "var(--zn-ink)" }}>
            +{bonusLedgers}
          </p>
        </div>
      </div>

      {/* Link */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[12.5px] truncate font-mono"
          style={{
            background: "var(--zn-surface-2)",
            border: "1px solid var(--zn-line-soft)",
            color: "var(--zn-ink-2)",
          }}
        >
          {referralUrl}
        </div>
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-2 rounded-xl whitespace-nowrap active:scale-95 transition-transform"
          style={{
            background: copied ? "var(--zn-safe)" : "var(--zn-ink)",
            color: "var(--zn-surface)",
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <p className="mt-3 text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
        Your colleague gets their first month free. You get the bonus ledger once they activate their account.
      </p>
    </div>
  );
}
