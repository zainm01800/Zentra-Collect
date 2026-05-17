"use client";

/**
 * InvoiceTeamPanel — internal notes and assignee management for an invoice.
 *
 * Designed to slot into the invoice detail page or review drawer.
 * Notes are private (not sent to customer). Assignee is visible to all
 * team members who can see this invoice.
 */

import { useEffect, useState } from "react";
import { MessageSquare, User, Plus, Trash2, Check } from "lucide-react";
import {
  readTeamData,
  setAssignee,
  addNote,
  deleteNote,
  getKnownTeamMembers,
  type InvoiceTeamData,
  type InvoiceNote,
} from "@/lib/invoice-team";

const TEAM_SUGGESTIONS = ["Mo", "Sara", "Amir", "Hannah", "James"];

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

interface Props {
  invoiceId: string;
  /** Name to use as author when adding notes */
  currentUser?: string;
}

export function InvoiceTeamPanel({ invoiceId, currentUser = "Me" }: Props) {
  const [data, setData] = useState<InvoiceTeamData>({
    invoiceId,
    assignee: null,
    notes: [],
    updatedAt: new Date().toISOString(),
  });
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const d = readTeamData(invoiceId);
    setData(d);
    setAssigneeInput(d.assignee ?? "");
  }, [invoiceId]);

  useEffect(() => {
    const known = getKnownTeamMembers();
    setSuggestions([...new Set([...TEAM_SUGGESTIONS, ...known])].sort());
  }, []);

  function refresh() {
    setData(readTeamData(invoiceId));
  }

  function handleSetAssignee(name: string | null) {
    setAssignee(invoiceId, name);
    setAssigneeInput(name ?? "");
    setEditingAssignee(false);
    refresh();
  }

  function handleAddNote() {
    if (!noteText.trim()) return;
    addNote(invoiceId, noteText, currentUser);
    setNoteText("");
    setAddingNote(false);
    setSaved(true);
    refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDeleteNote(noteId: string) {
    deleteNote(invoiceId, noteId);
    refresh();
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--zn-line-soft)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ background: "var(--zn-surface-2)", borderBottom: "1px solid var(--zn-line-soft)" }}
      >
        <MessageSquare className="size-4" style={{ color: "var(--zn-ink-3)" }} />
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
          Team
        </span>
        {saved && (
          <span className="ml-auto flex items-center gap-1 text-[11px]" style={{ color: "var(--zn-safe)" }}>
            <Check className="size-3" /> Note saved
          </span>
        )}
      </div>

      <div className="p-4 space-y-4" style={{ background: "var(--zn-surface)" }}>
        {/* Assignee */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "var(--zn-ink-3)" }}>
            Assigned to
          </div>

          {editingAssignee ? (
            <div className="space-y-2">
              <input
                type="text"
                value={assigneeInput}
                onChange={(e) => setAssigneeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetAssignee(assigneeInput || null)}
                placeholder="Team member name..."
                className="w-full rounded-lg border px-3 py-1.5 text-[13px] outline-none"
                style={{ background: "var(--zn-surface)", borderColor: "var(--zn-line)", color: "var(--zn-ink)" }}
                autoFocus
              />
              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.filter((s) => !assigneeInput || s.toLowerCase().includes(assigneeInput.toLowerCase())).slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSetAssignee(s)}
                      className="text-[11.5px] font-medium px-2.5 py-1 rounded-full transition-colors"
                      style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-2)" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  className="zn-pill"
                  style={{ height: 26, fontSize: 12, padding: "0 11px" }}
                  onClick={() => handleSetAssignee(assigneeInput || null)}
                >
                  Assign
                </button>
                {data.assignee && (
                  <button
                    className="zn-pill zn-pill-ghost"
                    style={{ height: 26, fontSize: 12, padding: "0 11px" }}
                    onClick={() => handleSetAssignee(null)}
                  >
                    Unassign
                  </button>
                )}
                <button
                  className="zn-pill zn-pill-ghost"
                  style={{ height: 26, fontSize: 12, padding: "0 11px" }}
                  onClick={() => setEditingAssignee(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="flex items-center gap-2 flex-1 rounded-lg px-3 py-2"
                style={{ background: "var(--zn-surface-2)" }}
              >
                <User className="size-3.5 shrink-0" style={{ color: data.assignee ? "var(--zn-safe)" : "var(--zn-ink-3)" }} />
                <span className="text-[13px]" style={{ color: data.assignee ? "var(--zn-ink)" : "var(--zn-ink-3)" }}>
                  {data.assignee ?? "Unassigned"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingAssignee(true)}
                className="text-[12px] font-medium px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--zn-surface-2)]"
                style={{ color: "var(--zn-ink-3)" }}
              >
                {data.assignee ? "Change" : "Assign"}
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
              Internal notes {data.notes.length > 0 && `(${data.notes.length})`}
            </div>
            {!addingNote && (
              <button
                type="button"
                onClick={() => setAddingNote(true)}
                className="flex items-center gap-1 text-[11.5px] font-medium transition-colors"
                style={{ color: "var(--zn-ink-3)" }}
              >
                <Plus className="size-3" /> Add note
              </button>
            )}
          </div>

          {/* Add note form */}
          {addingNote && (
            <div className="space-y-2 mb-3">
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-[13px] resize-none outline-none"
                style={{
                  background: "var(--zn-surface)",
                  borderColor: "var(--zn-line)",
                  color: "var(--zn-ink)",
                  minHeight: 72,
                }}
                placeholder="Internal note (not sent to customer)..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  className="zn-pill"
                  style={{ height: 26, fontSize: 12, padding: "0 11px" }}
                  disabled={!noteText.trim()}
                  onClick={handleAddNote}
                >
                  Save note
                </button>
                <button
                  className="zn-pill zn-pill-ghost"
                  style={{ height: 26, fontSize: 12, padding: "0 11px" }}
                  onClick={() => { setAddingNote(false); setNoteText(""); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Notes list */}
          {data.notes.length === 0 && !addingNote && (
            <p className="text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
              No notes yet. Add one to leave context for your team.
            </p>
          )}

          {data.notes.map((note: InvoiceNote) => (
            <div
              key={note.id}
              className="rounded-xl px-3 py-2.5 mb-2"
              style={{ background: "var(--zn-surface-2)", border: "1px solid var(--zn-line-soft)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] leading-relaxed flex-1" style={{ color: "var(--zn-ink)" }}>
                  {note.text}
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteNote(note.id)}
                  className="p-1 rounded transition-colors hover:bg-[var(--zn-risk-soft)] shrink-0"
                  title="Delete note"
                >
                  <Trash2 className="size-3" style={{ color: "var(--zn-ink-3)" }} />
                </button>
              </div>
              <p className="text-[10.5px] mt-1.5" style={{ color: "var(--zn-ink-3)" }}>
                {note.author} · {fmtDateTime(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
