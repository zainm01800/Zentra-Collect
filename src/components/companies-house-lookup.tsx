"use client";

/**
 * CompaniesHouseLookup — searches Companies House for a UK limited company
 * and displays incorporation date, status, address, and accounts filing state.
 *
 * Designed to sit on a customer profile page or card as a "credit signal"
 * widget. Searches by company name on mount if one is provided, or lets
 * the user search manually.
 */

import { useEffect, useState } from "react";
import { Search, Building2, AlertTriangle, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";

interface CompanyProfile {
  number: string;
  name: string;
  status: string;
  type: string;
  incorporatedOn?: string;
  dissolvedOn?: string;
  address: string | null;
  accountsDue?: string;
  lastAccountsMadeUpTo?: string;
  accountsOverdue: boolean;
  sicCodes: string[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:           { label: "Active",           color: "var(--zn-safe)"  },
  dissolved:        { label: "Dissolved",         color: "var(--zn-risk)"  },
  liquidation:      { label: "In liquidation",    color: "var(--zn-risk)"  },
  receivership:     { label: "In receivership",   color: "var(--zn-risk)"  },
  administration:   { label: "In administration", color: "var(--zn-risk)"  },
  "voluntary-arrangement": { label: "CVA",       color: "var(--zn-warn)"  },
  "converted-closed":  { label: "Converted/Closed", color: "var(--zn-ink-3)" },
  "insolvency-proceedings": { label: "Insolvent", color: "var(--zn-risk)" },
};

function fmtDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function yearsAgo(iso?: string): string | null {
  if (!iso) return null;
  const years = Math.floor((Date.now() - new Date(iso).getTime()) / (365.25 * 24 * 3600 * 1000));
  return years === 0 ? "less than 1 year" : `${years} year${years === 1 ? "" : "s"}`;
}

interface Props {
  /** Pre-fill the search with this company name on mount */
  defaultName?: string;
  /** Called when the user selects a company (for parent to save) */
  onSelect?: (profile: CompanyProfile) => void;
}

export function CompaniesHouseLookup({ defaultName, onSelect }: Props) {
  const [query, setQuery] = useState(defaultName ?? "");
  const [results, setResults] = useState<CompanyProfile[]>([]);
  const [selected, setSelected] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (defaultName) {
      void doSearch(defaultName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSearch(name: string) {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setSelected(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/companies-house?name=${encodeURIComponent(name.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(company: CompanyProfile) {
    setSelected(company);
    setResults([]);
    onSelect?.(company);
  }

  const statusInfo = selected ? (STATUS_LABELS[selected.status] ?? { label: selected.status, color: "var(--zn-ink-3)" }) : null;

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
        <Building2 className="size-4" style={{ color: "var(--zn-ink-3)" }} />
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--zn-ink-3)" }}>
          Companies House
        </span>
        {selected && (
          <a
            href={`https://find-and-update.company-information.service.gov.uk/company/${selected.number}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[11px]"
            style={{ color: "var(--zn-ink-3)" }}
          >
            View full profile <ExternalLink className="size-3" />
          </a>
        )}
      </div>

      <div className="p-4 space-y-3" style={{ background: "var(--zn-surface)" }}>
        {/* Search bar */}
        {!selected && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5" style={{ color: "var(--zn-ink-3)" }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
                placeholder="Search company name..."
                className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border outline-none"
                style={{
                  background: "var(--zn-surface)",
                  borderColor: "var(--zn-line)",
                  color: "var(--zn-ink)",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => doSearch(query)}
              disabled={loading || !query.trim()}
              className="zn-pill active:scale-95 transition-transform"
              style={{ height: 36 }}
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-[12px]" style={{ color: "var(--zn-risk)" }}>
            {error}
          </p>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div className="divide-y rounded-lg overflow-hidden" style={{ border: "1px solid var(--zn-line-soft)", borderColor: "var(--zn-line-soft)" }}>
            {results.map((co) => {
              const si = STATUS_LABELS[co.status] ?? { label: co.status, color: "var(--zn-ink-3)" };
              return (
                <button
                  key={co.number}
                  type="button"
                  onClick={() => handleSelect(co)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--zn-surface-2)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: "var(--zn-ink)" }}>{co.name}</p>
                      <p className="text-[11px] mt-0.5 font-mono" style={{ color: "var(--zn-ink-3)" }}>{co.number}</p>
                    </div>
                    <span
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: `${si.color}20`, color: si.color }}
                    >
                      {si.label}
                    </span>
                  </div>
                  {co.address && (
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--zn-ink-3)" }}>{co.address}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {searched && !loading && results.length === 0 && !selected && !error && (
          <p className="text-[12.5px] text-center py-2" style={{ color: "var(--zn-ink-3)" }}>
            No companies found. Try a different name or search by registration number.
          </p>
        )}

        {/* Selected company profile */}
        {selected && statusInfo && (
          <div className="space-y-3">
            {/* Status banner */}
            {selected.status !== "active" && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-medium"
                style={{ background: `${statusInfo.color}18`, color: statusInfo.color }}
              >
                <AlertTriangle className="size-4 shrink-0" />
                This company is <strong>{statusInfo.label}</strong>.{" "}
                {selected.dissolvedOn && `Dissolved ${fmtDate(selected.dissolvedOn)}.`}{" "}
                Review credit risk before chasing.
              </div>
            )}

            {/* Key facts grid */}
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Status"
                value={statusInfo.label}
                icon={
                  selected.status === "active"
                    ? <CheckCircle2 className="size-3.5" style={{ color: "var(--zn-safe)" }} />
                    : <XCircle className="size-3.5" style={{ color: "var(--zn-risk)" }} />
                }
              />
              <Stat label="Company no." value={selected.number} mono />
              <Stat label="Incorporated" value={fmtDate(selected.incorporatedOn) ?? "—"} />
              <Stat label="Age" value={yearsAgo(selected.incorporatedOn) ?? "—"} />
              {selected.address && (
                <div className="col-span-2">
                  <Stat label="Registered address" value={selected.address} />
                </div>
              )}
            </div>

            {/* Accounts filing */}
            <div
              className="rounded-xl p-3 flex items-start gap-2"
              style={{
                background: selected.accountsOverdue ? "var(--zn-risk-soft)" : "var(--zn-surface-2)",
                border: `1px solid ${selected.accountsOverdue ? "var(--zn-risk)" : "var(--zn-line-soft)"}`,
              }}
            >
              {selected.accountsOverdue
                ? <AlertTriangle className="size-4 shrink-0 mt-0.5" style={{ color: "var(--zn-risk)" }} />
                : <CheckCircle2 className="size-4 shrink-0 mt-0.5" style={{ color: "var(--zn-safe)" }} />
              }
              <div>
                <p className="text-[12px] font-semibold" style={{ color: selected.accountsOverdue ? "var(--zn-risk)" : "var(--zn-ink)" }}>
                  Accounts {selected.accountsOverdue ? "overdue" : "filing up to date"}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>
                  {selected.accountsDue && `Due: ${fmtDate(selected.accountsDue)}`}
                  {selected.lastAccountsMadeUpTo && ` · Last made up to: ${fmtDate(selected.lastAccountsMadeUpTo)}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setSelected(null); setSearched(false); setResults([]); }}
              className="text-[11.5px] underline"
              style={{ color: "var(--zn-ink-3)" }}
            >
              Search again
            </button>
          </div>
        )}

        {!searched && !selected && (
          <p className="text-[12px]" style={{ color: "var(--zn-ink-3)" }}>
            Search for a UK limited company to see incorporation date, status, and accounts filing information.
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{ background: "var(--zn-surface-2)" }}
    >
      <p className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: "var(--zn-ink-3)" }}>
        {label}
      </p>
      <div className="flex items-center gap-1.5 mt-0.5">
        {icon}
        <p
          className={`text-[12.5px] font-semibold ${mono ? "font-mono" : ""}`}
          style={{ color: "var(--zn-ink)" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
