import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IntegrationCard } from "@/components/integrations/integration-card";
import {
  syncFromXeroAction,
  syncFromQuickBooksAction,
  syncFromSageAction,
  getIntegrationStatusAction,
} from "@/actions/integrations/sync";
import { isXeroConfigured } from "@/lib/integrations/xero/client";
import { isQuickBooksConfigured } from "@/lib/integrations/quickbooks/client";
import { isSageConfigured } from "@/lib/integrations/sage/client";
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
      {params.error && <Banner kind="err">{decodeURIComponent(params.error)}</Banner>}

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
        </div>
      </Suspense>

      {/* Footer note */}
      <p className="text-[11.5px] mt-2 leading-5" style={{ color: "var(--zn-ink-3)" }}>
        Read-only access. We pull invoices, customers, and outstanding balances —
        nothing else. We never modify, void, or send anything back to your accounting system.
        Tokens are encrypted at rest and stored in your Zentra account.
      </p>
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
