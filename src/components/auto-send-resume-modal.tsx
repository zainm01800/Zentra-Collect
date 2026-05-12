"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Pencil } from "lucide-react";
import type { EmailUiSettings } from "@/lib/email/settings-store";

const DAY_LABELS: Record<string, string> = {
  "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu",
  "5": "Fri", "6": "Sat", "0": "Sun",
};

type Props = {
  open: boolean;
  settings: EmailUiSettings;
  onEnable: () => void;
  onEdit: () => void;
  onClose: () => void;
};

export function AutoSendResumeModal({ open, settings, onEnable, onEdit, onClose }: Props) {
  const days = settings.sendDays
    .split(",")
    .filter(Boolean)
    .map((d) => DAY_LABELS[d])
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Auto-send</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Mail className="size-3.5 shrink-0" />
          <span>Saved account</span>
        </div>

        <div className="rounded-2xl bg-zinc-50 dark:bg-[#28231c] border border-zinc-200 dark:border-[#2d2820] p-4 space-y-1.5 text-sm">
          <div>
            <span className="text-zinc-900 dark:text-[#f0e8d5] font-medium">From: </span>
            <span className="text-zinc-600 dark:text-[#8a7d69]">{settings.fromName} &lt;{settings.connectedEmail}&gt;</span>
          </div>
          <div>
            <span className="text-zinc-900 dark:text-[#f0e8d5] font-medium">Send time: </span>
            <span className="text-zinc-600 dark:text-[#8a7d69]">{settings.sendHourUtc}:00 UTC</span>
          </div>
          <div>
            <span className="text-zinc-900 dark:text-[#f0e8d5] font-medium">Days: </span>
            <span className="text-zinc-600 dark:text-[#8a7d69]">{days || "None selected"}</span>
          </div>
          <div>
            <span className="text-zinc-900 dark:text-[#f0e8d5] font-medium">Max per run: </span>
            <span className="text-zinc-600 dark:text-[#8a7d69]">{settings.maxPerRun} emails</span>
          </div>
        </div>

        <div className="rounded-xl bg-zinc-100 dark:bg-[#28231c] px-3 py-2 text-xs text-zinc-600 dark:text-[#8a7d69]">
          After enabling, there is a <strong>5-minute window</strong> to cancel before the first send is permitted.
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 rounded-full gap-1.5"
            onClick={onEdit}
          >
            <Pencil className="size-3" />
            Edit settings
          </Button>
          <Button className="flex-1 rounded-full" onClick={onEnable}>
            Enable auto-send
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
