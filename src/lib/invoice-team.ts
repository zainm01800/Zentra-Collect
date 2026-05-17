/**
 * Invoice team metadata — internal notes and assignment per invoice.
 *
 * Stored in localStorage separately from the main invoice store so they
 * survive invoice re-imports without being overwritten.
 *
 * Storage key: "zentra.invoiceTeam.v1"
 */

export interface InvoiceNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface InvoiceTeamData {
  invoiceId: string;
  assignee: string | null;
  notes: InvoiceNote[];
  updatedAt: string;
}

const STORAGE_KEY = "zentra.invoiceTeam.v1";

function readAll(): Record<string, InvoiceTeamData> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeAll(data: Record<string, InvoiceTeamData>): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

export function readTeamData(invoiceId: string): InvoiceTeamData {
  return readAll()[invoiceId] ?? { invoiceId, assignee: null, notes: [], updatedAt: new Date().toISOString() };
}

export function setAssignee(invoiceId: string, assignee: string | null): void {
  const all = readAll();
  const current = all[invoiceId] ?? { invoiceId, assignee: null, notes: [] };
  all[invoiceId] = { ...current, assignee, updatedAt: new Date().toISOString() };
  writeAll(all);
}

export function addNote(invoiceId: string, text: string, author: string): InvoiceNote {
  const all = readAll();
  const current = all[invoiceId] ?? { invoiceId, assignee: null, notes: [] };
  const note: InvoiceNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    text: text.trim(),
    author,
    createdAt: new Date().toISOString(),
  };
  all[invoiceId] = {
    ...current,
    notes: [note, ...(current.notes ?? [])],
    updatedAt: new Date().toISOString(),
  };
  writeAll(all);
  return note;
}

export function deleteNote(invoiceId: string, noteId: string): void {
  const all = readAll();
  if (!all[invoiceId]) return;
  all[invoiceId].notes = (all[invoiceId].notes ?? []).filter((n) => n.id !== noteId);
  all[invoiceId].updatedAt = new Date().toISOString();
  writeAll(all);
}

/** Return a list of team members who have notes or assignments (for the assignee picker) */
export function getKnownTeamMembers(): string[] {
  const all = readAll();
  const members = new Set<string>();
  for (const data of Object.values(all)) {
    if (data.assignee) members.add(data.assignee);
    for (const note of data.notes ?? []) {
      if (note.author) members.add(note.author);
    }
  }
  return Array.from(members).sort();
}
