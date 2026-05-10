"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { betaRequestsStorageKey, type BetaAccessRequest } from "@/lib/demo-auth";

function readRequests() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(betaRequestsStorageKey);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as BetaAccessRequest[];
  } catch {
    window.localStorage.removeItem(betaRequestsStorageKey);
    return [];
  }
}

export function BetaRequestsAdmin() {
  const [requests] = useState<BetaAccessRequest[]>(readRequests);

  return (
    <main className="min-h-screen bg-[#fbf8f1] px-4 py-10 text-neutral-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Local admin
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Beta requests
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            Local/mock view only. Production needs Supabase auth, an admin role,
            and a beta_requests table.
          </p>
        </div>

        {requests.length ? (
          <div className="grid gap-4">
            {requests.map((request) => (
              <Card key={`${request.email}-${request.requestedAt}`} className="rounded-3xl border-black/10 bg-white/70 shadow-none">
                <CardHeader>
                  <CardTitle>{request.businessName}</CardTitle>
                  <p className="text-sm text-neutral-500">
                    {request.name} - {request.email}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-neutral-700 sm:grid-cols-2 lg:grid-cols-3">
                  <Info label="Role" value={request.role} />
                  <Info label="Software" value={request.accountingSoftware} />
                  <Info label="Monthly invoices" value={request.monthlyInvoiceVolume} />
                  <Info label="AR pain" value={request.mainArPainPoint} />
                  <Info label="Sample file" value={request.wouldUploadSampleFile} />
                  <Info label="Would pay" value={request.wouldPayFoundingPricing} />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Info label="Message" value={request.optionalMessage || request.reason} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-black/10 bg-white/70 p-6 text-sm text-neutral-600">
            No local beta requests yet.
          </div>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-400">
        {label}
      </p>
      <p className="mt-1 font-medium text-neutral-800">{value || "Not provided"}</p>
    </div>
  );
}
