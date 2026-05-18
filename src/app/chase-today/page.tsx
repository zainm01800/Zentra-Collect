import { Suspense } from "react";
import { ChaseQueueDataWrapper } from "@/components/chase-queue-data-wrapper";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { DirectDebitNudge } from "@/components/direct-debit-nudge";
import { EmailEventsPill } from "@/components/email-events-pill";
import { PageHeader } from "@/components/page-header";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chase plan",
  description: "Your ranked chase plan. Each row shows the recommended action, the reason behind it, and a Review step before anything goes out.",
};

export default function ChaseTodayPage() {
  return (
    <div className="flex flex-col gap-5 lg:gap-6">
        <DemoModeBanner />
        <PageHeader
          kicker=""
          title="Chase plan"
          sub="Your ranked chase plan. Each row has a recommended action, the reason behind it, and a Review step before anything goes out."
          actions={
            <div className="flex items-center gap-2">
              <EmailEventsPill />
              <button className="zn-pill zn-pill-ghost">Export</button>
            </div>
          }
        />
        <DirectDebitNudge />
        <Suspense fallback={null}>
          <ChaseQueueDataWrapper onlyToday={false} />
        </Suspense>
    </div>
  );
}
