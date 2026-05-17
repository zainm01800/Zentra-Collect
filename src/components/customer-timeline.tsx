"use client";

/**
 * CustomerTimeline — unified chronological view of all communication and
 * status events across every invoice for a given customer.
 *
 * Aggregates activityHistory from all invoices, then sorts newest-first.
 * Groups events by date for scannability.
 */

import { useMemo } from "react";
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  MessageSquare,
  PhoneCall,
  Flag,
  ArrowUpRight,
  Import,
  Sparkles,
  Shield,
} from "lucide-react";
import type { Invoice } from "@/types/zentra";

type ActivityEventType =
  | "imported"
  | "recommendation_created"
  | "message_drafted"
  | "message_copied"
  | "chase_marked_sent"
  | "promise_recorded"
  | "promise_missed"
  | "dispute_recorded"
  | "dispute_resolved"
  | "remittance_requested"
  | "statement_requested"
  | "paid"
  | "note_added"
  | "safety_blocked"
  | string;

interface ActivityEvent {
  id: string;
  invoiceId?: string;
  invoiceNumber?: string;
  type: ActivityEventType;
  title: string;
  description: string;
  createdAt: string;
  createdBy: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  imported:               { icon: Import,        color: "var(--zn-ink-3)"  },
  recommendation_created: { icon: Sparkles,      color: "var(--zn-ink-3)"  },
  message_drafted:        { icon: Mail,           color: "var(--zn-ink-2)"  },
  message_copied:         { icon: Mail,           color: "var(--zn-ink-2)"  },
  chase_marked_sent:      { icon: ArrowUpRight,   color: "var(--zn-safe)"   },
  promise_recorded:       { icon: Clock,          color: "var(--zn-warn)"   },
  promise_missed:         { icon: AlertTriangle,  color: "var(--zn-risk)"   },
  dispute_recorded:       { icon: Flag,           color: "var(--zn-risk)"   },
  dispute_resolved:       { icon: CheckCircle2,   color: "var(--zn-safe)"   },
  remittance_requested:   { icon: FileText,       color: "var(--zn-ink-2)"  },
  statement_requested:    { icon: FileText,       color: "var(--zn-ink-2)"  },
  paid:                   { icon: CheckCircle2,   color: "var(--zn-safe)"   },
  note_added:             { icon: MessageSquare,  color: "var(--zn-ink-3)"  },
  safety_blocked:         { icon: Shield,         color: "var(--zn-warn)"   },
  call_logged:            { icon: PhoneCall,      color: "var(--zn-ink-2)"  },
};

const DEFAULT_CONFIG = { icon: MessageSquare, color: "var(--zn-ink-3)" };

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateBucket(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

interface Props {
  invoices: Invoice[];
  /** Max events to show initially (user can expand) */
  limit?: number;
}

export function CustomerTimeline({ invoices, limit = 30 }: Props) {
  const events = useMemo<ActivityEvent[]>(() => {
    const all: ActivityEvent[] = [];
    for (const inv of invoices) {
      for (const ev of inv.activityHistory ?? []) {
        all.push({
          ...ev,
          invoiceNumber: inv.invoiceNumber,
        });
      }
    }
    // Newest first
    return all.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ).slice(0, limit);
  }, [invoices, limit]);

  // Group by date bucket
  const grouped = useMemo(() => {
    const groups: { date: string; events: ActivityEvent[] }[] = [];
    let currentDate = "";
    for (const ev of events) {
      const d = dateBucket(ev.createdAt);
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: fmtDate(ev.createdAt), events: [] });
      }
      groups[groups.length - 1].events.push(ev);
    }
    return groups;
  }, [events]);

  if (events.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: "var(--zn-surface)", border: "1px solid var(--zn-line-soft)" }}
      >
        <p className="text-[13px]" style={{ color: "var(--zn-ink-3)" }}>
          No activity recorded yet. Events will appear here as you chase, record outcomes, and send messages.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {grouped.map(({ date, events: dayEvents }) => (
        <div key={date}>
          {/* Date separator */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.1em] shrink-0"
              style={{ color: "var(--zn-ink-3)" }}
            >
              {date}
            </span>
            <div className="flex-1 h-px" style={{ background: "var(--zn-line-soft)" }} />
          </div>

          {/* Events */}
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[15px] top-0 bottom-0 w-px"
              style={{ background: "var(--zn-line-soft)" }}
            />

            <div className="space-y-3 ml-9">
              {dayEvents.map((ev) => {
                const cfg = EVENT_CONFIG[ev.type] ?? DEFAULT_CONFIG;
                const Icon = cfg.icon;
                return (
                  <div key={ev.id} className="relative">
                    {/* Timeline dot */}
                    <div
                      className="absolute -left-9 top-2 size-[18px] rounded-full flex items-center justify-center"
                      style={{
                        background: "var(--zn-surface)",
                        border: `1.5px solid var(--zn-line-soft)`,
                      }}
                    >
                      <Icon
                        className="size-2.5"
                        style={{ color: cfg.color }}
                      />
                    </div>

                    {/* Event card */}
                    <div
                      className="rounded-xl px-3.5 py-3"
                      style={{
                        background: "var(--zn-surface)",
                        border: "1px solid var(--zn-line-soft)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-semibold" style={{ color: "var(--zn-ink)" }}>
                              {ev.title}
                            </p>
                            {ev.invoiceNumber && (
                              <span
                                className="text-[10.5px] font-mono px-1.5 py-0.5 rounded"
                                style={{ background: "var(--zn-surface-2)", color: "var(--zn-ink-3)" }}
                              >
                                {ev.invoiceNumber}
                              </span>
                            )}
                          </div>
                          {ev.description && (
                            <p className="text-[12px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                              {ev.description}
                            </p>
                          )}
                          <p className="text-[11px] mt-1" style={{ color: "var(--zn-ink-3)" }}>
                            {fmtTime(ev.createdAt)}{ev.createdBy ? ` · ${ev.createdBy}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
