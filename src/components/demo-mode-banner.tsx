"use client";

/**
 * Demo-mode banner — only renders for accounts on the "demo" plan.
 *
 * Previously rendered unconditionally on /chase-today, which misled
 * real signed-in users into thinking their imports were ephemeral
 * (fixes audit issue #3).
 */

import { DatabaseZap } from "lucide-react";
import { useLocalAccount } from "@/lib/billing/use-local-account";

export function DemoModeBanner() {
  const { account } = useLocalAccount();
  if (account?.planId !== "demo") return null;

  return (
    <div
      className="flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[12.5px]"
      style={{
        background: "var(--zn-surface-2)",
        color: "var(--zn-ink-3)",
        border: "1px solid var(--zn-line)",
      }}
    >
      <DatabaseZap className="size-3.5 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
      <p>Sample data — changes stay in your browser session only.</p>
    </div>
  );
}
