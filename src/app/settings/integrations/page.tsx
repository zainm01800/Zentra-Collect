import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { InboundEmailSettings } from "@/components/settings/inbound-email-settings";
import {
  syncFromXeroAction,
  syncFromQuickBooksAction,
  syncFromSageAction,
  syncFromFreeAgentAction,
  syncFromGoCardlessAction,
  getIntegrationStatusAction,
} from "@/actions/integrations/sync";
import { isXeroConfigured } from "@/lib/integrations/xero/client";
import { isQuickBooksConfigured } from "@/lib/integrations/quickbooks/client";
import { isSageConfigured } from "@/lib/integrations/sage/client";
import { isFreeAgentConfigured } from "@/lib/integrations/freeagent/client";
import { isGoCardlessConfigured } from "@/lib/integrations/gocardless/client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations · Settings",
  description: "Connect Zentra Collect to your accounting software.",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const status = await getIntegrationStatusAction();
  const xeroConfigured = isXeroConfigured();
  const qbConfigured   = isQuickBooksConfigured();
  const sageConfigured = isSageConfigured();
  const faConfigured   = isFreeAgentConfigured();
  const gcConfigured   = isGoCardlessConfigured();

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Back link */}
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium w-fit hover:opacity-70"
        style={{ color: "var(--zn-ink-3)" }}
      >
        <ArrowLeft className="size-3.5" />
        Back to settings
      </Link>

      {/* Heading */}
      <div>
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Workspace configuration
        </p>
        <h1
          className="text-[26px] font-semibold mt-1 leading-tight"
          style={{ color: "var(--zn-ink)" }}
        >
          Integrations
        </h1>
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Pull invoices straight from your accounting software — no CSV exports needed.
          Read-only: we never write back to your books.
        </p>
      </div>

      {/* Status banners */}
      {params.connected === "xero" && (
        <Banner kind="ok">
          Xero connected. Click <strong>Sync invoices now</strong> to pull your AR.
        </Banner>
      )}
      {params.connected === "quickbooks" && (
        <Banner kind="ok">
          QuickBooks connected. Click <strong>Sync invoices now</strong> to pull your AR.
        </Banner>
      )}
      {params.connected === "sage" && (
        <Banner kind="ok">
          Sage connected. Click <strong>Sync invoices now</strong> to pull your AR.
        </Banner>
      )}
      {params.connected === "freeagent" && (
        <Banner kind="ok">
          FreeAgent connected. Click <strong>Sync invoices now</strong> to pull your AR.
        </Banner>
      )}
      {params.connected === "gocardless" && (
        <Banner kind="ok">
          GoCardless connected. Click <strong>Sync invoices now</strong> to load your active Direct Debit mandates.
        </Banner>
      )}
      {params.error && <Banner kind="err">{decodeURIComponent(params.error)}</Banner>}

      {/* Bank feed entry-point — separate surface lives at /banking */}
      <Link
        href="/banking"
        className="group flex items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[var(--zn-surface-2)]"
        style={{
          background: "var(--zn-surface)",
          border:     "1px solid var(--zn-line-soft)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-10 rounded-lg flex items-center justify-center text-[13px] font-bold text-white"
            style={{ background: "#1E3A8A" }}
          >
            B
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Bank feed (Open Banking)
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
              Connect your UK bank via TrueLayer. Incoming payments auto-match to invoices and (when imported from an accounting tool) write back automatically.
            </p>
          </div>
        </div>
        <span className="text-[12.5px] font-medium" style={{ color: "var(--zn-ink-2)" }}>
          Open →
        </span>
      </Link>

      {/* Cards */}
      <Suspense fallback={<div className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>Loading…</div>}>
        <div className="grid gap-4 sm:grid-cols-1">
          <IntegrationCard
            name="Xero"
            brandColor="#13B5EA"
            tagline="Sync your AR from Xero — supports multi-org bookkeeping."
            connectPath="/api/integrations/xero/connect"
            disconnectPath="/api/integrations/xero/disconnect"
            syncAction={syncFromXeroAction}
            connected={status.xero.connected}
            tenantName={status.xero.tenantName}
            notConfigured={!xeroConfigured}
          />
          <IntegrationCard
            name="QuickBooks Online"
            brandColor="#2CA01C"
            tagline="Sync your AR from QuickBooks Online (UK or international)."
            connectPath="/api/integrations/quickbooks/connect"
            disconnectPath="/api/integrations/quickbooks/disconnect"
            syncAction={syncFromQuickBooksAction}
            connected={status.quickbooks.connected}
            tenantName={status.quickbooks.tenantName}
            notConfigured={!qbConfigured}
          />
          <IntegrationCard
            name="Sage Business Cloud"
            brandColor="#00DC06"
            tagline="Sync your AR from Sage Business Cloud Accounting (UK)."
            connectPath="/api/integrations/sage/connect"
            disconnectPath="/api/integrations/sage/disconnect"
            syncAction={syncFromSageAction}
            connected={status.sage.connected}
            tenantName={status.sage.tenantName}
            notConfigured={!sageConfigured}
          />
          <IntegrationCard
            name="FreeAgent"
            brandColor="#28B473"
            tagline="Sync your AR from FreeAgent — built for UK freelancers and small practices."
            connectPath="/api/integrations/freeagent/connect"
            disconnectPath="/api/integrations/freeagent/disconnect"
            syncAction={syncFromFreeAgentAction}
            connected={status.freeagent.connected}
            tenantName={status.freeagent.tenantName}
            notConfigured={!faConfigured}
          />
          <IntegrationCard
            name="GoCardless"
            brandColor="#04284C"
            tagline="Pull active Direct Debit mandates so the chase plan skips customers on autopay."
            connectPath="/api/integrations/gocardless/connect"
            disconnectPath="/api/integrations/gocardless/disconnect"
            syncAction={syncFromGoCardlessAction}
            connected={status.gocardless.connected}
            tenantName={status.gocardless.tenantName}
            notConfigured={!gcConfigured}
          />
        </div>
      </Suspense>

      {/* Footer note */}
      <p className="text-[11.5px] mt-2 leading-5" style={{ color: "var(--zn-ink-3)" }}>
        Read-only access. We pull invoices, customers, and outstanding balances —
        nothing else. We never modify, void, or send anything back to your accounting system.
        Tokens are encrypted at rest and stored in your Zentra account.
      </p>

      {/* Inbound reply classification */}
      <div>
        <p
          className="text-[10.5px] font-semibold uppercase tracking-[0.16em] mb-3"
          style={{ color: "var(--zn-ink-3)" }}
        >
          Inbound replies
        </p>
        <InboundEmailSettings />
      </div>
    </div>
  );
}

function Banner({ kind, children }: { kind: "ok" | "err"; children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-[12.5px] leading-5"
      style={{
        background: kind === "ok" ? "var(--zn-safe-soft)" : "var(--zn-risk-soft)",
        color:      kind === "ok" ? "var(--zn-safe)" : "var(--zn-risk)",
      }}
    >
      {children}
    </div>
  );
}
