// ⚠️  THIS PAGE IS COMPLETELY UNPROTECTED.
// It is intentionally open during demo/development so the team can view
// submissions without standing up auth. Add authentication middleware before
// deploying to any publicly accessible URL.
//
// TODO: Protect this route with Supabase session check or HTTP Basic Auth
//   before exposing to the internet.
//
// TODO: Once submissions are stored in Supabase, replace getBetaRequests()
//   with a server-side Supabase query and add a "reviewed" toggle.

import Link from "next/link";
import { getBetaRequests, getBetaRequestCount } from "@/lib/beta/store";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const dynamic = "force-dynamic";

export default function BetaRequestsAdminPage() {
  const requests = getBetaRequests();
  const count = getBetaRequestCount();

  return (
    <div className="min-h-screen bg-[#fbf8f1] text-neutral-950">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* ── Warning banner ─────────────────────────────────────────────── */}
        <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-700">
            ⚠ Unprotected admin page — demo only
          </p>
          <p className="mt-1 text-sm text-red-600">
            This page has no authentication. Do not deploy to a public URL
            without adding session protection. Data shown here resets on server
            restart (in-memory storage only).
          </p>
        </div>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
              Admin
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Beta requests
            </h1>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold">{count}</p>
            <p className="text-sm text-neutral-500">
              {count === 1 ? "submission" : "submissions"} this session
            </p>
          </div>
        </div>

        {/* ── Storage note ───────────────────────────────────────────────── */}
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>In-memory only.</strong> These submissions are stored in the
          server process and will be lost when the server restarts or the
          serverless function cold-starts. Wire up Supabase persistence before
          taking the product live.
        </div>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {requests.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-black/15 py-16 text-center">
            <p className="text-sm font-medium text-neutral-500">
              No submissions yet this session.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Fill in the{" "}
              <Link
                href="/request-access"
                className="underline underline-offset-2 hover:text-neutral-700"
              >
                request access form
              </Link>{" "}
              to see a submission appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {[...requests].reverse().map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-black/8 bg-white p-5"
              >
                {/* Top row */}
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-neutral-950">{req.name}</p>
                    <p className="text-sm text-neutral-500">{req.email}</p>
                    <p className="mt-0.5 text-sm text-neutral-600">
                      {req.businessName}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        req.isBookkeeper
                          ? "bg-blue-50 text-blue-700"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {req.isBookkeeper ? "Bookkeeper / accountant" : "Own business"}
                    </span>
                    <p className="mt-1.5 font-mono text-xs text-neutral-400">
                      {formatDate(req.submittedAt)}
                    </p>
                  </div>
                </div>

                {/* Detail grid */}
                <div className="mt-4 grid gap-3 border-t border-black/6 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {req.isBookkeeper && req.clientLedgersManaged && (
                    <Detail label="Client ledgers" value={req.clientLedgersManaged} />
                  )}
                  {req.approximateInvoicesPerMonth && (
                    <Detail
                      label="Invoices/month"
                      value={req.approximateInvoicesPerMonth}
                    />
                  )}
                  {req.accountingSoftware.length > 0 && (
                    <Detail
                      label="Software"
                      value={req.accountingSoftware.join(", ")}
                    />
                  )}
                  {req.biggestArPain.length > 0 && (
                    <Detail
                      label="AR pains"
                      value={req.biggestArPain.join(", ")}
                      wide
                    />
                  )}
                  <Detail
                    label="Upload sample file?"
                    value={req.wouldUploadSampleFile ? "Yes" : "No"}
                  />
                  <Detail
                    label="Would pay founding price?"
                    value={
                      req.wouldPayFoundingPricing === "yes"
                        ? "Yes"
                        : req.wouldPayFoundingPricing === "maybe"
                        ? "Maybe"
                        : "No"
                    }
                  />
                </div>

                {/* Optional message */}
                {req.message && (
                  <div className="mt-3 rounded-xl border border-black/6 bg-[#fbf8f1] px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
                      Message
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-neutral-700">
                      {req.message}
                    </p>
                  </div>
                )}

                {/* ID */}
                <p className="mt-3 font-mono text-[0.65rem] text-neutral-300">
                  {req.id}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 flex gap-4">
          <Link
            href="/request-access"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            ← Request access form
          </Link>
          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
      <p className="text-xs font-medium text-neutral-400">{label}</p>
      <p className="mt-0.5 text-sm text-neutral-700">{value}</p>
    </div>
  );
}
