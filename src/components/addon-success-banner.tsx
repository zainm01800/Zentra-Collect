"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";

export function AddonSuccessBanner({ addonSuccess }: { addonSuccess: string | undefined }) {
  const router = useRouter();
  const [visible, setVisible] = useState(addonSuccess === "email");

  useEffect(() => {
    if (addonSuccess === "email") {
      // Strip the param so a refresh doesn't re-show it
      router.replace("/settings");
    }
  }, [addonSuccess, router]);

  if (!visible) return null;

  return (
    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3 text-sm mb-2">
      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
      <span className="flex-1 text-emerald-900 font-medium">
        Email auto-send add-on activated — set up your SMTP below to start sending.
      </span>
      <button
        onClick={() => setVisible(false)}
        className="text-emerald-700 hover:text-emerald-900 shrink-0"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
