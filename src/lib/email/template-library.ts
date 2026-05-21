/**
 * Email template library.
 *
 * A small set of starter chase templates the user can copy, fork, and
 * save their own variants of. Stored in localStorage (per-browser) so
 * the feature works without a backend round-trip. Each template carries
 * a tone so the action drawer can suggest the right one to drop in.
 *
 * Token placeholders: {{customerName}}, {{invoiceNumber}}, {{amount}},
 * {{dueDate}}, {{daysOverdue}}, {{businessName}}.
 */

import type { ReminderTone } from "@/types/cashpilot";

const STORAGE_KEY = "zn:email-templates:v1";

export interface EmailTemplate {
  id:        string;
  name:      string;
  tone:      ReminderTone;
  subject:   string;
  body:      string;
  /** Built-in starters can't be deleted, only forked. */
  builtIn?:  boolean;
}

export const STARTER_TEMPLATES: EmailTemplate[] = [
  {
    id:      "starter-friendly-1",
    name:    "Friendly nudge",
    tone:    "Friendly",
    builtIn: true,
    subject: "Quick reminder: invoice {{invoiceNumber}}",
    body:
      "Hi {{customerName}},\n\n" +
      "Hope you're well. Just a quick note — invoice {{invoiceNumber}} for {{amount}} was due on {{dueDate}}.\n\n" +
      "Could you let me know when payment is expected? Happy to help if there's anything outstanding from our side.\n\n" +
      "Thanks,\n{{businessName}}",
  },
  {
    id:      "starter-friendly-2",
    name:    "Friendly check-in (small balance)",
    tone:    "Friendly",
    builtIn: true,
    subject: "Just checking in — invoice {{invoiceNumber}}",
    body:
      "Hi {{customerName}},\n\n" +
      "I wanted to check in on invoice {{invoiceNumber}} ({{amount}}). It's a small one so it may have slipped through — could you confirm when it'll be settled?\n\n" +
      "Thanks,\n{{businessName}}",
  },
  {
    id:      "starter-neutral-1",
    name:    "Neutral payment reminder",
    tone:    "Neutral",
    builtIn: true,
    subject: "Payment reminder: invoice {{invoiceNumber}}",
    body:
      "Hi {{customerName}},\n\n" +
      "Invoice {{invoiceNumber}} for {{amount}} is now {{daysOverdue}} days overdue.\n\n" +
      "Please could you confirm when payment will be made, or let me know if there's anything blocking it?\n\n" +
      "Thanks,\n{{businessName}}",
  },
  {
    id:      "starter-firm-1",
    name:    "Firm follow-up",
    tone:    "Firm",
    builtIn: true,
    subject: "Action needed: invoice {{invoiceNumber}}",
    body:
      "Hi {{customerName}},\n\n" +
      "Invoice {{invoiceNumber}} for {{amount}} is now {{daysOverdue}} days overdue and remains unpaid despite previous reminders.\n\n" +
      "Please confirm the expected payment date today so we can update our records.\n\n" +
      "Regards,\n{{businessName}}",
  },
  {
    id:      "starter-final-1",
    name:    "Final notice",
    tone:    "Final notice",
    builtIn: true,
    subject: "Final notice: invoice {{invoiceNumber}}",
    body:
      "Hi {{customerName}},\n\n" +
      "Invoice {{invoiceNumber}} for {{amount}} is now significantly overdue ({{daysOverdue}} days).\n\n" +
      "Please confirm immediate payment, or let us know today if there is a specific issue we need to resolve.\n\n" +
      "Regards,\n{{businessName}}",
  },
  {
    id:      "starter-statement",
    name:    "Statement request",
    tone:    "Neutral",
    builtIn: true,
    subject: "Statement of account — {{businessName}}",
    body:
      "Hi {{customerName}},\n\n" +
      "Please find our current statement of account for your records. We have a number of items currently outstanding totalling {{amount}}.\n\n" +
      "Could you confirm the expected payment date for each?\n\n" +
      "Thanks,\n{{businessName}}",
  },
];

// ── persistence ────────────────────────────────────────────────────────────

function readStore(): EmailTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(items: EmailTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    void import("@/lib/sync/workspace-sync").then(({ pushDataType, getLocalSupabaseAccountId }) => {
      const id = getLocalSupabaseAccountId();
      if (id) return pushDataType("email_templates", id);
    }).catch(() => {});
  } catch {
    /* quota exceeded — drop silently */
  }
}

// ── public API ─────────────────────────────────────────────────────────────

export function listTemplates(): EmailTemplate[] {
  const userTemplates = readStore();
  return [...STARTER_TEMPLATES, ...userTemplates];
}

export function saveTemplate(template: Omit<EmailTemplate, "id" | "builtIn"> & { id?: string }): EmailTemplate {
  const items = readStore();
  const id = template.id ?? `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const next: EmailTemplate = { ...template, id, builtIn: false };
  const existing = items.findIndex((t) => t.id === id);
  if (existing >= 0) items[existing] = next;
  else items.push(next);
  writeStore(items);
  return next;
}

export function deleteTemplate(id: string): void {
  const items = readStore().filter((t) => t.id !== id);
  writeStore(items);
}

/** Fill the {{placeholders}} in a template's subject + body. */
export function renderTemplate(
  template: EmailTemplate,
  vars: {
    customerName?:  string;
    invoiceNumber?: string;
    amount?:        string;
    dueDate?:       string;
    daysOverdue?:   number | string;
    businessName?:  string;
  },
): { subject: string; body: string } {
  const replace = (s: string) =>
    s
      .replaceAll("{{customerName}}",  vars.customerName  ?? "")
      .replaceAll("{{invoiceNumber}}", vars.invoiceNumber ?? "")
      .replaceAll("{{amount}}",        vars.amount        ?? "")
      .replaceAll("{{dueDate}}",       vars.dueDate       ?? "")
      .replaceAll("{{daysOverdue}}",   String(vars.daysOverdue ?? ""))
      .replaceAll("{{businessName}}",  vars.businessName  ?? "");
  return { subject: replace(template.subject), body: replace(template.body) };
}
