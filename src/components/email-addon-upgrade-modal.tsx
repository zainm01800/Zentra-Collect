"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import type { PlanId } from "@/lib/account/plans";

type Props = {
  open: boolean;
  onClose: () => void;
  planId?: PlanId;
};

export function EmailAddonUpgradeModal({ open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const price = "£5/mo";

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addonType: "email" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add email auto-send</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="size-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
            <Mail className="size-7 text-zinc-700" />
          </div>

          <div className="text-center space-y-1">
            <p className="text-2xl font-semibold">{price}</p>
            <p className="text-sm text-muted-foreground">
              Email auto-send add-on · billed monthly
            </p>
          </div>

          <ul className="w-full space-y-2 text-sm text-zinc-700">
            {[
              "Automatic hourly send cycle via your SMTP",
              "Up to 20 emails per run, configurable schedule",
              "7-day cooldown per customer prevents spam",
              "Full send log — who was chased, when, and why",
            ].map((feat) => (
              <li key={feat} className="flex items-start gap-2">
                <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground text-center">
            Cancel anytime from your Stripe billing portal. Does not affect your base plan.
          </p>

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1 rounded-full" onClick={onClose}>
              Not now
            </Button>
            <Button className="flex-1 rounded-full" onClick={handleUpgrade} disabled={loading}>
              {loading && <Loader2 className="size-3 mr-1.5 animate-spin" />}
              Add for {price}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
