"use client";

/**
 * Integration card — generic UI for an OAuth-based accounting integration.
 *
 * Three states:
 *   - Not connected     → "Connect" CTA
 *   - Connected         → "Sync now" + "Disconnect" + last-sync timestamp
 *   - Syncing           → spinner state
 *
 * Provider-agnostic — pass the OAuth endpoints + sync action via props.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, Plug, RefreshCw, X } from "lucide-react";
import type { SyncResult } from "@/actions/integrations/sync";
import { importedInvoicesStorageKey } from "@/lib/import/zentra-import";
import { readLocalAccount } from "@/lib/demo-auth";
import {
  readActiveClientId,
  clientInvoicesKey,
} from "@/lib/bookkeeper-clients";
import { writeDirectDebitEmails } from "@/lib/collections/dd-cache";

const BOOKKEEPER_PLAN_IDS = ["bookkeeper_starter", "bookkeeper_pro"];

function resolveInvoiceKey(planId: string): string {
  if (BOOKKEEPER_PLAN_IDS.includes(planId)) {
    const activeClientId = readActiveClientId();
    if (activeClientId && activeClientId !== "all") {
      return clientInvoicesKey(activeClientId);
    }
  }
  return importedInvoicesStorageKey;
}

interface IntegrationCardProps {
  /** Display name: "Xero" / "QuickBooks Online". */
  name:          string;
  /** Brand logo as a colour hex string for the badge fallback. */
  brandColor:    string;
  /** Tagline shown beneath the name. */
  tagline:       string;
  /** Path to OAuth start route. */
  connectPath:   string;
  /** Path to disconnect route (POST). */
  disconnectPath: string;
  /** Server action that returns invoices for this provider. */
  syncAction:    () => Promise<SyncResult>;
  /** Connection state from getIntegrationStatusAction. */
  connected:     boolean;
  /** Tenant/org name to display when connected. */
  tenantName?:   string;
  /** When true, the necessary env vars haven't been set on the server. */
  notConfigured: boolean;
}

export function IntegrationCard({
  name,
  brandColor,
  tagline,
  connectPath,
  disconnectPath,
  syncAction,
  connected,
  tenantName,
  notConfigured,
}: IntegrationCardProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setLastResult(null);

    try {
      const result = await syncAction();
      if (result.ok) {
        // Mandate-source integrations (GoCardless) return a list of
        // emails on active Direct Debit instead of invoices. Cache them
        // so the chase engine can suppress chases for these customers.
        if (result.directDebitEmails) {
          writeDirectDebitEmails(result.directDebitEmails);
        }
        // Some integrations (e.g. GoCardless) sync mandates, not invoices —
        // they return ok with summary but no invoices array. Skip the
        // localStorage write in that case.
        if (result.invoices) {
          const account = readLocalAccount();
          const key = resolveInvoiceKey(account?.planId ?? "");
          try {
            window.localStorage.setItem(key, JSON.stringify(result.invoices));
          } catch (storageErr) {
            console.error("[IntegrationCard] localStorage write failed:", storageErr);
            setLastResult({ kind: "err", message: "Saved server-side but couldn't cache locally." });
            return;
          }
        }
        setLastResult({ kind: "ok", message: result.summary ?? "Sync complete." });
        startTransition(() => router.refresh());
      } else {
        setLastResult({ kind: "err", message: result.error ?? "Sync failed." });
      }
    } catch (err) {
      setLastResult({
        kind: "err",
        message: err instanceof Error ? err.message : "Sync failed.",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${name}? Imported invoices stay until your next sync.`)) return;
    try {
      const r = await fetch(disconnectPath, { method: "POST" });
      if (!r.ok) throw new Error("Disconnect failed");
      startTransition(() => router.refresh());
    } catch (err) {
      setLastResult({ kind: "err", message: err instanceof Error ? err.message : "Failed to disconnect." });
    }
  }

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--zn-surface)",
        border:     "1px solid var(--zn-line-soft)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className="size-10 rounded-lg flex items-center justify-center text-[14px] font-bold text-white tracking-tight"
            style={{ background: brandColor }}
          >
            {name.slice(0, 1)}
          </div>
          <div>
            <p className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              {name}
            </p>
            <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
              {tagline}
            </p>
          </div>
        </div>
        {connected && (
          <span
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md"
            style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
          >
            <CheckCircle2 className="size-3" />
            Connected
          </span>
        )}
      </div>

      {/* Connection details */}
      {connected && tenantName && (
        <p className="text-[12.5px] mb-3" style={{ color: "var(--zn-ink-2)" }}>
          Organisation: <span className="font-medium">{tenantName}</span>
        </p>
      )}

      {/* Coming-soon state for integrations whose OAuth app isn't live yet. */}
      {notConfigured && (
        <div
          className="rounded-lg px-3 py-2 mb-3 text-[12px] leading-5"
          style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}
        >
          Coming soon — {name} support is in the works. Email
          {" "}
          <a href="mailto:hello@zentracollect.co.uk" style={{ color: "var(--zn-ink-2)", textDecoration: "underline" }}>
            hello@zentracollect.co.uk
          </a>
          {" "}if you&apos;d like early access.
        </div>
      )}

      {/* Actions */}
      {!connected && !notConfigured && (
        <a
          href={connectPath}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold w-fit"
          style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
        >
          <Plug className="size-3.5" />
          Connect {name}
          <ArrowRight className="size-3.5" />
        </a>
      )}

      {connected && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing || isPending}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-60"
            style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
          >
            {syncing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            {syncing ? "Syncing…" : "Sync invoices now"}
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[12.5px] font-medium"
            style={{
              background: "transparent",
              border:     "1px solid var(--zn-line)",
              color:      "var(--zn-ink-2)",
            }}
          >
            <X className="size-3" />
            Disconnect
          </button>
        </div>
      )}

      {/* Result message */}
      {lastResult && (
        <p
          className="mt-3 text-[12px] leading-5"
          style={{
            color: lastResult.kind === "ok" ? "var(--zn-safe)" : "var(--zn-risk)",
          }}
        >
          {lastResult.message}
        </p>
      )}
    </div>
  );
}
