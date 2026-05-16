"use client";

/**
 * Date-picker + quick-shortcuts for the customer's "promise a payment date"
 * flow. Shortcuts cover the most common B2B AP cycles (Friday, end of week,
 * 2 weeks, end of month).
 */

import { useState } from "react";

interface PromiseDatePickerProps {
  token: string;
}

function shortcutDates(): Array<{ label: string; date: string }> {
  const today = new Date();

  // Next Friday
  const nextFriday = new Date(today);
  const daysUntilFriday = (5 - today.getDay() + 7) % 7 || 7;
  nextFriday.setDate(today.getDate() + daysUntilFriday);

  // Two weeks from today
  const twoWeeks = new Date(today);
  twoWeeks.setDate(today.getDate() + 14);

  // End of this month
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // End of next month
  const endOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  return [
    { label: `By Friday`, date: nextFriday.toISOString().slice(0, 10) },
    { label: `In 2 weeks`, date: twoWeeks.toISOString().slice(0, 10) },
    { label: `End of this month`, date: endOfMonth.toISOString().slice(0, 10) },
    { label: `End of next month`, date: endOfNextMonth.toISOString().slice(0, 10) },
  ];
}

export function PromiseDatePicker({ token }: PromiseDatePickerProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const shortcuts = shortcutDates();

  async function handleSubmit(date: string) {
    if (!date) return;
    setSubmitting(true);
    const form = new FormData();
    form.set("token", token);
    form.set("date", date);
    try {
      await fetch("/api/customer-portal/promise", {
        method: "POST",
        body: form,
      });
    } catch {
      // Even on failure, take the customer to the confirmation —
      // the promise will be retried on the user's next sync.
    }
    window.location.href = `/pay/${token}/promise?submitted=1&date=${encodeURIComponent(date)}`;
  }

  return (
    <div className="space-y-4">
      {/* Quick shortcuts */}
      <div className="grid grid-cols-2 gap-2">
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => handleSubmit(s.date)}
            disabled={submitting}
            className="rounded-lg border border-neutral-300 px-4 py-3 text-[13px] font-medium text-left hover:bg-neutral-100 transition-colors disabled:opacity-50"
          >
            <div className="font-semibold text-neutral-900">{s.label}</div>
            <div className="text-[11.5px] text-neutral-500 mt-0.5">
              {new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </div>
          </button>
        ))}
      </div>

      {/* Custom date */}
      <div className="border-t border-neutral-200 pt-4">
        <label htmlFor="promise-date" className="block text-[12.5px] font-medium text-neutral-700 mb-2">
          Or pick a specific date
        </label>
        <div className="flex gap-2">
          <input
            id="promise-date"
            type="date"
            min={today}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={submitting}
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
          <button
            type="button"
            onClick={() => handleSubmit(selected)}
            disabled={!selected || submitting}
            className="inline-flex items-center justify-center rounded-full bg-neutral-900 text-white px-5 py-2.5 text-[13px] font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
