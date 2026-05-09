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
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf8f1] px-4 text-neutral-950">
      <div className="max-w-md rounded-[2rem] border border-black/10 bg-white/80 p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-neutral-600">
          Opening the Zentra Collect demo with sample data...
        </p>
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
