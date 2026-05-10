"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { readLocalAccount, writeLocalAccount, createUsageCounters } from "@/lib/demo-auth";
import type { DemoUser } from "@/lib/demo-auth";

type Props = {
  checkoutSuccess: boolean;
  importSyncFailed: boolean;
};

export function CheckoutSuccessBanner({ checkoutSuccess, importSyncFailed }: Props) {
  const router = useRouter();
  const [planName, setPlanName] = useState<string | null>(null);
  const [polling, setPolling] = useState(checkoutSuccess);
  const [syncWarning] = useState(importSyncFailed);

  useEffect(() => {
    if (!checkoutSuccess) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 8;
    const INTERVAL_MS = 2000;

    async function poll() {
      try {
        const res = await fetch("/api/account/me");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.authenticated || !data.hasAccount || !data.account) return;

        const serverAccount: Omit<DemoUser, "usage"> = data.account;
        const existing = readLocalAccount();

        // Webhook has fired when plan is no longer "trial"
        if (serverAccount.planId && serverAccount.planId !== "trial" && serverAccount.planId !== "demo") {
          const usage = existing?.usage ?? createUsageCounters();
          writeLocalAccount({ ...serverAccount, usage });
          setPlanName(serverAccount.planId.replace(/_/g, " "));
          setPolling(false);
          // Strip the query param
          router.replace("/dashboard");
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    }

    const interval = setInterval(async () => {
      attempts++;
      const done = await poll();
      if (done || attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        setPolling(false);
        if (!done) router.replace("/dashboard");
      }
    }, INTERVAL_MS);

    // Run immediately too
    poll();

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutSuccess]);

  useEffect(() => {
    if (syncWarning) {
      localStorage.removeItem("zentra.importSyncFailed.v1");
    }
  }, [syncWarning]);

  if (!checkoutSuccess && !syncWarning) return null;

  return (
    <div className="flex flex-col gap-2 mb-5">
      {checkoutSuccess && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800">
          {polling ? (
            <Loader2 className="size-4 shrink-0 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0" />
          )}
          {polling
            ? "Confirming your payment — this takes a few seconds…"
            : planName
              ? `You're on the ${planName} plan. Welcome!`
              : "Payment confirmed — your plan has been upgraded."}
        </div>
      )}
      {syncWarning && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm bg-amber-50 border border-amber-200 text-amber-800">
          <span className="shrink-0">⚠</span>
          Your import was saved locally but could not sync to the cloud. Re-import to ensure your data persists across devices.
        </div>
      )}
    </div>
  );
}
