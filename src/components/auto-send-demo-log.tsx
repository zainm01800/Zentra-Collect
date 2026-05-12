"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { getDemoPhase } from "@/lib/email/settings-store";

const FAKE_LOG = [
  {
    id: 1,
    name: "A. T***",
    subject: "Invoice #1042 — payment reminder",
    sentAt: "Today, 09:02",
    amount: "£2,400",
  },
  {
    id: 2,
    name: "B. R***",
    subject: "Invoice #1039 — overdue notice",
    sentAt: "Today, 09:02",
    amount: "£850",
  },
  {
    id: 3,
    name: "C. M***",
    subject: "Invoice #1031 — second reminder",
    sentAt: "Today, 09:03",
    amount: "£5,100",
  },
];

export function AutoSendDemoLog() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function check() {
      setVisible(getDemoPhase() === "on");
    }
    check();
    window.addEventListener("zentra:emailSettingsChanged", check);
    return () => window.removeEventListener("zentra:emailSettingsChanged", check);
  }, []);

  if (!visible) return null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white dark:bg-[#211d17] overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-2">
        <Mail className="size-4 text-zinc-500" />
        <span className="text-sm font-medium text-zinc-800">Auto-send log</span>
        <span className="ml-auto text-xs bg-zinc-100 text-zinc-500 rounded-full px-2 py-0.5">
          Demo — simulated data
        </span>
      </div>
      <div className="divide-y divide-zinc-100">
        {FAKE_LOG.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800 truncate">{entry.name}</p>
              <p className="text-xs text-zinc-500 truncate">{entry.subject}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-medium text-zinc-700">{entry.amount}</p>
              <p className="text-[10px] text-zinc-400">{entry.sentAt}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-100">
        <p className="text-xs text-zinc-400">
          3 emails sent this run · next run scheduled for 10:00 UTC
        </p>
      </div>
    </div>
  );
}
