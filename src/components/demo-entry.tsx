"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createLocalAccount,
  demoUserStorageKey,
  writeLocalAccount,
} from "@/lib/demo-auth";
import { accountUsageStorageKey } from "@/lib/account/usage";
import {
  importedInvoicesStorageKey,
  importDiffStorageKey,
  importSummaryStorageKey,
} from "@/lib/import/zentra-import";

const previousAccountStorageKey = "zentra.previousAccountBeforeDemo.v1";
const demoInvoiceStateStorageKey = "zentra.demoInvoiceState.v1";

export function DemoEntry() {
  const router = useRouter();

  useEffect(() => {
    const existingAccount = window.localStorage.getItem(demoUserStorageKey);
    if (existingAccount) {
      window.localStorage.setItem(previousAccountStorageKey, existingAccount);
    }

    window.localStorage.removeItem(importedInvoicesStorageKey);
    window.localStorage.removeItem(importSummaryStorageKey);
    window.localStorage.removeItem(importDiffStorageKey);
    // Clear any previously customised demo state — readImportedInvoices() falls
    // back to the built-in demoInvoices when this key is absent.
    window.localStorage.removeItem(demoInvoiceStateStorageKey);
    resetDemoUsage();

    writeLocalAccount(
      createLocalAccount({
        name: "Demo user",
        email: "demo@zentracollect.co.uk",
        businessName: "Zentra Demo Workspace",
        planId: "demo",
      }),
    );
    // Brief pause so the splash actually registers — feels intentional, not a flash.
    const t = setTimeout(() => router.replace("/dashboard"), 1500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 relative z-[1]"
      style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
    >
      <div className="zn-card max-w-[420px] w-full p-8 text-center">
        <div
          className="size-14 mx-auto rounded-lg inline-flex items-center justify-center mb-5"
          style={{
            background: "var(--zn-ink)",
            color: "var(--zn-surface)",
            fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 26,
          }}
        >
          Z
        </div>
        <div className="zn-label !p-0 mb-2">Setting up your workspace</div>
        <h1
          className="text-[24px] tracking-[-0.015em] leading-[1.2] text-[#1d1813] dark:text-[#f0e8d5]"
          style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
        >
          Opening the demo with sample data…
        </h1>
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Loading 18 sample invoices, 8 customers, and a ranked chase plan.
        </p>
        <div className="mt-6 flex justify-center">
          <span className="zn-pulse" />
        </div>
      </div>
    </main>
  );
}

function resetDemoUsage() {
  const storedUsage = window.localStorage.getItem(accountUsageStorageKey);
  if (!storedUsage) return;

  try {
    const allUsage = JSON.parse(storedUsage) as Record<string, unknown>;
    delete allUsage["local-demo"];
    window.localStorage.setItem(accountUsageStorageKey, JSON.stringify(allUsage));
  } catch {
    window.localStorage.removeItem(accountUsageStorageKey);
  }
}
