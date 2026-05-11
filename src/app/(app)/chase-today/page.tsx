"use client";

import { AppShell } from "@/components/app-shell";
import { ChaseQueue } from "@/components/chase-queue";
import { demoInvoices } from "@/data/demo-invoices";

export default function ChaseTodayPage() {
  return (
    <AppShell>
      <div className="min-w-0 transition-all duration-300">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-black tracking-tight text-neutral-950 leading-none lg:text-[32px]">Collections Queue</h1>
            <p className="mt-2 text-[14px] text-neutral-500 lg:text-[15px]">Work through your ranked chase plan.</p>
          </div>
        </div>
        <ChaseQueue 
          initialInvoices={demoInvoices} 
          onlyToday={false}
        />
      </div>
    </AppShell>
  );
}
