"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import {
  STARTER_TEMPLATES,
  deleteTemplate,
  listTemplates,
  saveTemplate,
  type EmailTemplate,
} from "@/lib/email/template-library";
import type { ReminderTone } from "@/types/cashpilot";

const TONES: ReminderTone[] = ["Friendly", "Neutral", "Firm", "Final notice"];

export function TemplateLibraryEditor() {
  const [items, setItems] = useState<EmailTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    name: string; tone: ReminderTone; subject: string; body: string;
  }>({ name: "", tone: "Friendly", subject: "", body: "" });
  const [copyState, setCopyState] = useState<string | null>(null);

  useEffect(() => {
    setItems(listTemplates());
  }, []);

  const selected = items.find((t) => t.id === selectedId);

  function startFork(t: EmailTemplate) {
    setSelectedId(null);
    setDraft({
      name:    `${t.name} (copy)`,
      tone:    t.tone,
      subject: t.subject,
      body:    t.body,
    });
  }

  function startNew() {
    setSelectedId(null);
    setDraft({ name: "", tone: "Friendly", subject: "", body: "" });
  }

  function save() {
    if (!draft.name.trim() || !draft.body.trim()) return;
    const saved = saveTemplate(draft);
    setItems(listTemplates());
    setSelectedId(saved.id);
  }

  function remove(id: string) {
    deleteTemplate(id);
    setItems(listTemplates());
    if (selectedId === id) setSelectedId(null);
  }

  function copyBody(t: EmailTemplate) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`${t.subject}\n\n${t.body}`);
      setCopyState(t.id);
      setTimeout(() => setCopyState((current) => (current === t.id ? null : current)), 1500);
    }
  }

  const userTemplates = items.filter((t) => !t.builtIn);

  return (
    <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
      {/* List */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-medium border transition-colors hover:bg-[var(--zn-surface-2)]"
          style={{ borderColor: "var(--zn-line)", color: "var(--zn-ink-2)" }}
        >
          <Plus className="size-3.5" /> New template
        </button>

        <p className="text-[10.5px] uppercase tracking-wider mt-2" style={{ color: "var(--zn-ink-3)" }}>
          Starters ({STARTER_TEMPLATES.length})
        </p>
        {STARTER_TEMPLATES.map((t) => (
          <TemplateRow
            key={t.id}
            t={t}
            selected={selectedId === t.id}
            onSelect={() => setSelectedId(t.id)}
            onCopy={() => copyBody(t)}
            onFork={() => startFork(t)}
            copied={copyState === t.id}
          />
        ))}

        {userTemplates.length > 0 && (
          <>
            <p className="text-[10.5px] uppercase tracking-wider mt-3" style={{ color: "var(--zn-ink-3)" }}>
              Your templates ({userTemplates.length})
            </p>
            {userTemplates.map((t) => (
              <TemplateRow
                key={t.id}
                t={t}
                selected={selectedId === t.id}
                onSelect={() => setSelectedId(t.id)}
                onCopy={() => copyBody(t)}
                onDelete={() => remove(t.id)}
                copied={copyState === t.id}
              />
            ))}
          </>
        )}
      </div>

      {/* Editor / preview */}
      <div
        className="rounded-xl p-4 flex flex-col gap-3"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        {selected ? (
          <>
            <h3 className="text-[14.5px] font-semibold">{selected.name}</h3>
            <p className="text-[11.5px]" style={{ color: "var(--zn-ink-3)" }}>
              Tone: {selected.tone}{selected.builtIn ? " · starter (read-only)" : ""}
            </p>
            <div className="rounded-lg p-3 text-[12.5px] font-mono whitespace-pre-wrap"
                 style={{ background: "var(--zn-bg-2)" }}>
              <strong>Subject:</strong> {selected.subject}
              {"\n\n"}{selected.body}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyBody(selected)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border hover:bg-[var(--zn-surface-2)]"
                style={{ borderColor: "var(--zn-line)" }}
              >
                <Copy className="size-3" /> {copyState === selected.id ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => startFork(selected)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border hover:bg-[var(--zn-surface-2)]"
                style={{ borderColor: "var(--zn-line)" }}
              >
                Fork & edit
              </button>
              {!selected.builtIn && (
                <button
                  type="button"
                  onClick={() => remove(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border hover:bg-red-50"
                  style={{ borderColor: "var(--zn-line)", color: "#b91c1c" }}
                >
                  <Trash2 className="size-3" /> Delete
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h3 className="text-[14.5px] font-semibold">
              {draft.name ? draft.name : "New template"}
            </h3>
            <Field label="Name">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. 'Long-term client gentle nudge'"
                className="w-full rounded-md px-3 py-2 text-[13px] border"
                style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface-2)", color: "var(--zn-ink)" }}
              />
            </Field>
            <Field label="Tone">
              <select
                value={draft.tone}
                onChange={(e) => setDraft({ ...draft, tone: e.target.value as ReminderTone })}
                className="w-full rounded-md px-3 py-2 text-[13px] border"
                style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface-2)", color: "var(--zn-ink)" }}
              >
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <input
                type="text"
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                className="w-full rounded-md px-3 py-2 text-[13px] border font-mono"
                style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface-2)", color: "var(--zn-ink)" }}
              />
            </Field>
            <Field label="Body">
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                rows={10}
                className="w-full rounded-md px-3 py-2 text-[13px] border font-mono"
                style={{ borderColor: "var(--zn-line)", background: "var(--zn-surface-2)", color: "var(--zn-ink)" }}
              />
            </Field>
            <div>
              <button
                type="button"
                onClick={save}
                disabled={!draft.name.trim() || !draft.body.trim()}
                className="rounded-full text-[12.5px] font-medium px-4 py-2 disabled:opacity-40"
                style={{ background: "var(--zn-ink)", color: "var(--zn-surface)" }}
              >
                Save template
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TemplateRow({
  t, selected, onSelect, onCopy, onFork, onDelete, copied,
}: {
  t: EmailTemplate;
  selected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onFork?: () => void;
  onDelete?: () => void;
  copied: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-3 cursor-pointer transition-colors ${
        selected ? "ring-2 ring-emerald-500" : ""
      }`}
      style={{
        background: "var(--zn-surface)",
        border: "1px solid var(--zn-line-soft)",
      }}
      onClick={onSelect}
    >
      <p className="text-[13px] font-semibold leading-tight">{t.name}</p>
      <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>{t.tone}</p>
      <div className="flex gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onCopy}
          className="text-[10.5px] underline hover:no-underline"
          style={{ color: "var(--zn-ink-2)" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        {onFork && (
          <>
            <span className="text-[10.5px] text-neutral-400">·</span>
            <button
              type="button"
              onClick={onFork}
              className="text-[10.5px] underline hover:no-underline"
              style={{ color: "var(--zn-ink-2)" }}
            >
              Fork
            </button>
          </>
        )}
        {onDelete && (
          <>
            <span className="text-[10.5px] text-neutral-400">·</span>
            <button
              type="button"
              onClick={onDelete}
              className="text-[10.5px] underline hover:no-underline text-red-700"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10.5px] uppercase tracking-wider block mb-1" style={{ color: "var(--zn-ink-3)" }}>{label}</span>
      {children}
    </label>
  );
}
