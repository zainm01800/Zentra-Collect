"use client";

/**
 * Handles one-click sync from a connected accounting integration (Xero, QuickBooks, etc.).
 * Calls the server action, receives the invoice list, writes to localStorage, then redirects
 * to the import summary so the user can review before the data is committed.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import {
  syncFromXeroAction,
  syncFromQuickBooksAction,
  syncFromSageAction,
  syncFromFreeAgentAction,
} from "@/actions/integrations/sync";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";

type Provider = "xero" | "quickbooks" | "sage" | "freeagent";

const PROVIDER_LABELS: Record<Provider, string> = {
  xero: "Xero",
  quickbooks: "QuickBooks",
  sage: "Sage",
  freeagent: "FreeAgent",
};

interface Props {
  provider: Provider;
  onBack: () => void;
}

export function IntegrationSyncFlow({ provider, onBack }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"syncing" | "done" | "error">("syncing");
  const [summary, setSummary] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const syncFn =
          provider === "xero" ? syncFromXeroAction :
          provider === "quickbooks" ? syncFromQuickBooksAction :
          provider === "sage" ? syncFromSageAction :
          syncFromFreeAgentAction;

        const result = await syncFn();

        if (cancelled) return;

        if (!result.ok) {
          setErrorMsg(result.error ?? "Sync failed. Try again or use a CSV export.");
          setPhase("error");
          return;
        }

        // Write invoices to localStorage so the import summary can pick them up
        if (result.invoices && result.invoices.length > 0) {
          localStorage.setItem(importedInvoicesStorageKey, JSON.stringify(result.invoices));
        }

        setSummary(result.summary ?? `${result.invoices?.length ?? 0} invoices synced.`);
        setPhase("done");

        // Brief pause so the user sees the confirmation, then go to summary
        setTimeout(() => {
          if (!cancelled) router.push("/import/summary");
        }, 1200);
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unexpected error during sync.";
        setErrorMsg(msg);
        setPhase("error");
      }
    }

    run();
    return () => { cancelled = true; };
  }, [provider, router]);

  const label = PROVIDER_LABELS[provider];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-opacity hover:opacity-70"
        style={{ color: "var(--zn-ink-3)" }}
      >
        <ArrowLeft className="size-3.5" />
        Back
      </button>

      <div
        className="rounded-xl px-5 py-6 flex flex-col items-center gap-4 text-center"
        style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
      >
        {phase === "syncing" && (
          <>
            <Loader2 className="size-8 animate-spin" style={{ color: "var(--zn-ink-3)" }} />
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                Syncing from {label}…
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
                Fetching your open invoices — this usually takes a few seconds.
              </p>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <CheckCircle2 className="size-8" style={{ color: "var(--zn-safe)" }} />
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                Sync complete
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
                {summary} Taking you to review…
              </p>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <AlertTriangle className="size-8" style={{ color: "var(--zn-risk)" }} />
            <div>
              <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                Sync failed
              </p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
                {errorMsg}
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                onClick={onBack}
                className="zn-pill zn-pill-ghost"
              >
                Try a different method
              </button>
              <a
                href="/settings/integrations"
                className="zn-pill"
              >
                Check connection
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
