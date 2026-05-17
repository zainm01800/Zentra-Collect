"use client";

/**
 * RecurringInvoices — manage recurring invoice templates.
 *
 * Renders a list of active/paused templates and a "New recurring" button
 * that opens an inline creation form. Mount on the Invoices page.
 */

import { useEffect, useState } from "react";
import { Plus, RefreshCw, Pause, Play, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  readTemplates,
  saveTemplate,
  deleteTemplate,
  toggleTemplate,
  newTemplate,
  nextGenerationDate,
  processRecurringInvoices,
} from "@/lib/recurring-invoices";
import type { RecurringTemplate, RecurringFrequency } from "@/lib/recurring-invoices";
import { formatCurrency } from "@/lib/formatters";

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  weekly:    "Every week",
  monthly:   "Every month",
  quarterly: "Every quarter",
  annually:  "Every year",
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Form ──────────────────────────────────────────────────────────────────────

interface FormProps {
  initial?: RecurringTemplate;
  onSave: (t: RecurringTemplate) => void;
  onCancel: () => void;
}

function TemplateForm({ initial, onSave, onCancel }: FormProps) {
  const [t, setT] = useState<RecurringTemplate>(initial ?? newTemplate());

  function patch(partial: Partial<RecurringTemplate>) {
    setT((prev) => {
      const next = { ...prev, ...partial };
      // Recalculate nextDueAt whenever frequency or dayOfMonth changes
      if (partial.frequency !== undefined || partial.dayOfMonth !== undefined) {
        next.nextDueAt = nextGenerationDate(next.frequency, next.dayOfMonth);
      }
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!t.customerName.trim() || t.amount <= 0) return;
    onSave(t);
  }

  return (
    <form onSubmit={submit} className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--zn-ink-3)" }}>
        {initial ? "Edit recurring invoice" : "New recurring invoice"}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="block col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Customer *</span>
          <input
            required
            value={t.customerName}
            onChange={(e) => patch({ customerName: e.target.value })}
            placeholder="Customer name"
            className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
          />
        </label>
        <label className="block col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Customer email</span>
          <input
            type="email"
            value={t.customerEmail ?? ""}
            onChange={(e) => patch({ customerEmail: e.target.value })}
            placeholder="billing@customer.co.uk"
            className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Description</span>
        <input
          value={t.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="e.g. Monthly retainer — web support"
          className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
        />
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Amount (£) *</span>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={t.amount || ""}
            onChange={(e) => patch({ amount: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Frequency</span>
          <select
            value={t.frequency}
            onChange={(e) => patch({ frequency: e.target.value as RecurringFrequency })}
            className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Day of month</span>
          <input
            type="number"
            min="1"
            max="28"
            value={t.dayOfMonth}
            onChange={(e) => patch({ dayOfMonth: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })}
            className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
            style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-[11px] font-medium block mb-1" style={{ color: "var(--zn-ink-3)" }}>Payment terms (days until due)</span>
        <input
          type="number"
          min="0"
          max="90"
          value={t.netDays}
          onChange={(e) => patch({ netDays: parseInt(e.target.value) || 30 })}
          className="w-full rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
        />
      </label>

      <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
        Next invoice will be generated on <strong style={{ color: "var(--zn-ink)" }}>{fmtDate(t.nextDueAt)}</strong>
      </p>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="zn-pill active:scale-95 transition-transform"
        >
          {initial ? "Save changes" : "Create recurring invoice"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="zn-pill zn-pill-ghost active:scale-95 transition-transform"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Template row ──────────────────────────────────────────────────────────────

function TemplateRow({
  template,
  onEdit,
  onToggle,
  onDelete,
}: {
  template: RecurringTemplate;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "var(--zn-surface)",
        border: "1px solid var(--zn-line-soft)",
        opacity: template.active ? 1 : 0.55,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
            {template.customerName}
          </span>
          <span
            className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}
          >
            {FREQ_LABELS[template.frequency]}
          </span>
          {!template.active && (
            <span
              className="text-[10.5px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "var(--zn-warn-soft)", color: "var(--zn-warn)" }}
            >
              Paused
            </span>
          )}
        </div>
        <p className="text-[12px] mt-0.5 truncate" style={{ color: "var(--zn-ink-3)" }}>
          {template.description || "No description"} · {formatCurrency(template.amount)} · Net {template.netDays}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
          Next: {fmtDate(template.nextDueAt)}
          {template.lastGeneratedAt && ` · Last: ${fmtDate(template.lastGeneratedAt)}`}
        </p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="text-[12px] font-medium px-2.5 py-1 rounded-lg transition-colors hover:bg-[var(--zn-surface-2)]"
          style={{ color: "var(--zn-ink-2)" }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--zn-surface-2)]"
          title={template.active ? "Pause" : "Resume"}
        >
          {template.active
            ? <Pause className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
            : <Play className="size-3.5" style={{ color: "var(--zn-safe)" }} />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--zn-risk-soft)]"
          title="Delete"
        >
          <Trash2 className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RecurringInvoices() {
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [creating, setCreating]   = useState(false);
  const [editing, setEditing]     = useState<string | null>(null);
  const [expanded, setExpanded]   = useState(false);
  const [generated, setGenerated] = useState(0);

  useEffect(() => {
    const count = processRecurringInvoices();
    if (count > 0) setGenerated(count);
    setTemplates(readTemplates());
  }, []);

  function handleSave(t: RecurringTemplate) {
    saveTemplate(t);
    setTemplates(readTemplates());
    setCreating(false);
    setEditing(null);
  }

  function handleToggle(id: string, active: boolean) {
    toggleTemplate(id, !active);
    setTemplates(readTemplates());
  }

  function handleDelete(id: string) {
    deleteTemplate(id);
    setTemplates(readTemplates());
  }

  const active = templates.filter((t) => t.active);
  const paused = templates.filter((t) => !t.active);

  return (
    <div
      className="rounded-2xl"
      style={{ border: "1px solid var(--zn-line-soft)", overflow: "hidden" }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[var(--zn-surface-2)]"
        style={{ background: "var(--zn-surface)" }}
      >
        <div className="flex items-center gap-3">
          <RefreshCw className="size-4" style={{ color: "var(--zn-ink-3)" }} />
          <div>
            <p className="text-[13.5px] font-semibold" style={{ color: "var(--zn-ink)" }}>
              Recurring invoices
            </p>
            <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
              {active.length} active{paused.length > 0 ? `, ${paused.length} paused` : ""}
              {templates.length === 0 ? " · auto-generate invoices on a schedule" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {generated > 0 && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
            >
              {generated} generated today
            </span>
          )}
          {expanded
            ? <ChevronUp className="size-4" style={{ color: "var(--zn-ink-3)" }} />
            : <ChevronDown className="size-4" style={{ color: "var(--zn-ink-3)" }} />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 py-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--zn-line-soft)" }}>
          {generated > 0 && (
            <div
              className="rounded-xl px-4 py-2.5 text-[12.5px]"
              style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}
            >
              {generated} invoice{generated > 1 ? "s" : ""} auto-generated today from your recurring schedules.
            </div>
          )}

          {templates.map((t) =>
            editing === t.id ? (
              <TemplateForm
                key={t.id}
                initial={t}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <TemplateRow
                key={t.id}
                template={t}
                onEdit={() => setEditing(t.id)}
                onToggle={() => handleToggle(t.id, t.active)}
                onDelete={() => handleDelete(t.id)}
              />
            ),
          )}

          {creating && (
            <TemplateForm
              onSave={handleSave}
              onCancel={() => setCreating(false)}
            />
          )}

          {!creating && !editing && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="zn-pill zn-pill-ghost w-full justify-center active:scale-95 transition-transform"
            >
              <Plus className="size-3.5" /> New recurring invoice
            </button>
          )}

          {templates.length === 0 && !creating && (
            <p className="text-[12.5px] text-center py-2" style={{ color: "var(--zn-ink-3)" }}>
              No recurring invoices yet. Add one and Zentra will generate it automatically on schedule.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
