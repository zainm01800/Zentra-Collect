"use client";

import { Button } from "@/components/ui/button";
import type { ReminderTone } from "@/types/cashpilot";
import { cn } from "@/lib/utils";

const tones: ReminderTone[] = ["Friendly", "Neutral", "Firm", "Final notice"];

export function ToneSelector({
  value,
  onChange,
}: {
  value: ReminderTone;
  onChange: (tone: ReminderTone) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tones.map((tone) => (
        <Button
          key={tone}
          type="button"
          variant={value === tone ? "default" : "outline"}
          className={cn("justify-center", tone === "Final notice" && "text-xs")}
          onClick={() => onChange(tone)}
        >
          {tone}
        </Button>
      ))}
    </div>
  );
}
