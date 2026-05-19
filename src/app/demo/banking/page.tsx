"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const OPEN_INVOICES = [
  { ref: "INV-2026-0138", customer: "BluePeak Ltd",          amount: 12250 },
  { ref: "INV-2026-0142", customer: "Oaktree Consulting",    amount: 8400  },
  { ref: "INV-2026-0151", customer: "Meridian Studio",       amount: 4800  },
  { ref: "INV-2026-0147", customer: "BluePeak Ltd",          amount: 3200  },
  { ref: "INV-2026-0153", customer: "Meridian Studio",       amount: 2350  },
  { ref: "INV-2026-0149", customer: "Oaktree Consulting",    amount: 2900  },
  { ref: "INV-2026-0158", customer: "Harrow Digital",        amount: 4200  },
  { ref: "INV-2026-0156", customer: "Harborgate Architects", amount: 1200  },
];

type TxState = "matched" | "likely" | "unmatched" | "outgoing";

interface Tx {
  id: string;
  week: string;
  date: string;
  desc: string;
  ref: string;
  bank: string;
  amount: number;
  kind: "credit" | "debit";
  state: TxState;
  matched?: string;
  suggestion?: string;
  customer?: string;
  category?: string;
  noteCustomer?: boolean;
}

const INITIAL_TX: Tx[] = [
  { id: "t1",  week: "Week of 12 May 2026", date: "16 May", desc: "MERIDIAN STUDIO LTD",  ref: "FPS REF 8842139",  bank: "HSBC", amount: 4200,  kind: "credit", state: "matched",   matched: "INV-2026-0140",    customer: "Meridian Studio"          },
  { id: "t2",  week: "Week of 12 May 2026", date: "15 May", desc: "BLUEPEAK LTD PAYMENT", ref: "BACS 0035-1142",   bank: "BARC", amount: 12250, kind: "credit", state: "likely",    suggestion: "INV-2026-0138", customer: "BluePeak Ltd"             },
  { id: "t3",  week: "Week of 12 May 2026", date: "15 May", desc: "STRIPE PAYOUT",        ref: "PAYOUT po_1MqX",   bank: "STAR", amount: 980,   kind: "credit", state: "unmatched"                                                              },
  { id: "t4",  week: "Week of 12 May 2026", date: "14 May", desc: "GOOGLE WORKSPACE",     ref: "DD 8842",          bank: "MNZO", amount: 184,   kind: "debit",  state: "outgoing",  category: "Software"                                      },
  { id: "t5",  week: "Week of 12 May 2026", date: "13 May", desc: "OAKTREE CONSULTING",   ref: "FPS REF 9954221",  bank: "NWST", amount: 2900,  kind: "credit", state: "likely",    suggestion: "INV-2026-0149", customer: "Oaktree Consulting"       },
  { id: "t6",  week: "Week of 12 May 2026", date: "12 May", desc: "HARROW DIGITAL",       ref: "BACS 9988-7766",   bank: "LLOY", amount: 4200,  kind: "credit", state: "matched",   matched: "INV-2026-0158",    customer: "Harrow Digital"           },
  { id: "t7",  week: "Week of 5 May 2026",  date: "9 May",  desc: "MERIDIAN STUDIO LTD",  ref: "FPS REF 8841992",  bank: "HSBC", amount: 6750,  kind: "credit", state: "matched",   matched: "INV-2026-0136",    customer: "Meridian Studio"          },
  { id: "t8",  week: "Week of 5 May 2026",  date: "8 May",  desc: "REFUND — TFL",         ref: "REFUND 113",       bank: "BARC", amount: 86,    kind: "credit", state: "unmatched"                                                              },
  { id: "t9",  week: "Week of 5 May 2026",  date: "7 May",  desc: "HMRC VAT REFUND",      ref: "BACS HMRC-VAT",    bank: "NWST", amount: 1840,  kind: "credit", state: "likely",    suggestion: "HMRC Q4 VAT refund", customer: "HM Revenue & Customs", noteCustomer: true },
  { id: "t10", week: "Week of 5 May 2026",  date: "6 May",  desc: "AWS LONDON",           ref: "DD INV 220",       bank: "MNZO", amount: 450,   kind: "debit",  state: "outgoing",  category: "Hosting"                                       },
  { id: "t11", week: "Week of 5 May 2026",  date: "5 May",  desc: "OAKTREE CONSULTING",   ref: "FPS REF 9953018",  bank: "NWST", amount: 18500, kind: "credit", state: "matched",   matched: "INV-2026-0133",    customer: "Oaktree Consulting"       },
  { id: "t12", week: "Week of 5 May 2026",  date: "5 May",  desc: "BLUEPEAK LTD PAYMENT", ref: "BACS 0035-1108",   bank: "BARC", amount: 3200,  kind: "credit", state: "matched",   matched: "INV-2026-0147",    customer: "BluePeak Ltd"             },
];

function fmtGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DemoBankingPage() {
  const [txList, setTxList] = useState<Tx[]>(INITIAL_TX);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // KPIs
  const monthIn = txList.filter((t) => t.kind === "credit").reduce((s, t) => s + t.amount, 0);
  const unmatchedSum = txList.filter((t) => t.kind === "credit" && (t.state === "unmatched" || t.state === "likely")).reduce((s, t) => s + t.amount, 0);
  const matchedCount = txList.filter((t) => t.state === "matched").length;

  // Group by week (preserve order)
  const weekOrder: string[] = [];
  const byWeek: Record<string, Tx[]> = {};
  for (const t of txList) {
    if (!byWeek[t.week]) { byWeek[t.week] = []; weekOrder.push(t.week); }
    byWeek[t.week].push(t);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function confirmMatch(id: string, ref: string) {
    setTxList((prev) => prev.map((t) => t.id === id ? { ...t, state: "matched", matched: ref } : t));
    setOpenId(null);
    showToast(`Matched to ${ref}`);
  }

  function rejectLikely(id: string) {
    setTxList((prev) => prev.map((t) => t.id === id ? { ...t, state: "unmatched", suggestion: undefined } : t));
    // keep openId open so user can search
  }

  function handleRowClick(tx: Tx) {
    if (tx.state === "matched" || tx.state === "outgoing") return;
    setOpenId((prev) => (prev === tx.id ? null : tx.id));
    setSearchQuery("");
  }

  const filteredInvoices = OPEN_INVOICES.filter((inv) => {
    const q = searchQuery.toLowerCase();
    return !q || inv.ref.toLowerCase().includes(q) || inv.customer.toLowerCase().includes(q);
  });

  return (
    <div>
      <div>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#1A1916", margin: 0 }}>Bank feed</h1>
            <p style={{ fontSize: 13.5, color: "#8A8680", marginTop: 4 }}>Read-only · synced 19 May 2026 at 09:42</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={ghostBtn}>Connect bank</button>
            <button style={pillBtn}>Sync now</button>
          </div>
        </div>

        {/* Sync banner */}
        {!bannerDismissed && (
          <div style={{
            background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10,
            padding: "10px 14px", fontSize: 12.5, color: "#1E40AF",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 20, gap: 8,
          }}>
            <span>Read-only bank feed. Match incoming payments to open invoices to mark them as settled.</span>
            <button onClick={() => setBannerDismissed(true)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#1E40AF", fontSize: 16, lineHeight: 1, padding: 2,
              flexShrink: 0,
            }}>✕</button>
          </div>
        )}

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
          <KpiCard label="Month in" value={`+${fmtGBP(monthIn)}`} valueColor="#16A34A" />
          <KpiCard label="Unmatched" value={fmtGBP(unmatchedSum)} valueColor="#C28800" />
          <KpiCard label="Matched" value={`${matchedCount} transactions`} valueColor="#8A8680" />
        </div>

        {/* Transactions by week */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {weekOrder.map((week) => {
            const wTxs = byWeek[week];
            const wIn = wTxs.filter((t) => t.kind === "credit").reduce((s, t) => s + t.amount, 0);
            const wOut = wTxs.filter((t) => t.kind === "debit").reduce((s, t) => s + t.amount, 0);

            return (
              <div key={week}>
                {/* Week header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#8A8680", textTransform: "uppercase", letterSpacing: "0.06em" }}>{week}</span>
                  <span style={{ fontSize: 12, color: "#8A8680" }}>
                    <span style={{ color: "#16A34A", fontWeight: 600 }}>+{fmtGBP(wIn)}</span>
                    {" in"}
                    {wOut > 0 && <> · <span style={{ color: "#8A8680" }}>−{fmtGBP(wOut)}</span>{" out"}</>}
                  </span>
                </div>

                {/* Card */}
                <div style={cardStyle}>
                  {wTxs.map((tx, i) => {
                    const isOpen = openId === tx.id;
                    return (
                      <div key={tx.id} style={{ borderBottom: i < wTxs.length - 1 ? "1px solid rgba(0,0,0,0.06)" : undefined }}>
                        {/* Main row */}
                        <div
                          onClick={() => handleRowClick(tx)}
                          style={{
                            display: "grid", gridTemplateColumns: "44px 1fr auto auto",
                            gap: 14, alignItems: "center", padding: "12px 18px",
                            cursor: (tx.state === "matched" || tx.state === "outgoing") ? "default" : "pointer",
                            background: isOpen ? "#FAFAFA" : undefined,
                            transition: "background 0.15s",
                          }}
                        >
                          {/* Bank badge */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: "#F4F4F5", border: "1px solid rgba(0,0,0,0.08)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, fontWeight: 700, color: "#8A8680", letterSpacing: "0.04em",
                            flexShrink: 0,
                          }}>
                            {tx.bank}
                          </div>

                          {/* Desc + ref */}
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1916", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {tx.desc}
                            </p>
                            <p style={{ fontSize: 11, color: "#8A8680", margin: 0, fontFamily: "monospace" }}>{tx.ref}</p>
                          </div>

                          {/* Match pill */}
                          <div>
                            <MatchPill tx={tx} />
                          </div>

                          {/* Amount + date */}
                          <div style={{ textAlign: "right", minWidth: 80 }}>
                            <p style={{
                              fontSize: 13, fontWeight: 700, margin: 0,
                              color: tx.kind === "credit" ? "#16A34A" : "#8A8680",
                            }}>
                              {tx.kind === "credit" ? "+" : "−"}{fmtGBP(tx.amount)}
                            </p>
                            <p style={{ fontSize: 11, color: "#8A8680", margin: 0 }}>{tx.date}</p>
                          </div>
                        </div>

                        {/* Expanded: likely */}
                        {isOpen && tx.state === "likely" && (
                          <div style={{
                            margin: "0 18px 14px", padding: "14px 16px",
                            background: "#FFFBEB", border: "1px solid #FDE68A",
                            borderRadius: 10, fontSize: 13,
                          }}>
                            <p style={{ color: "#92400E", margin: "0 0 12px", fontWeight: 500 }}>
                              Match this payment of{" "}
                              <strong>{fmtGBP(tx.amount)}</strong> to{" "}
                              <strong>{tx.suggestion}</strong>
                              {tx.customer ? ` — ${tx.customer}` : ""}?
                            </p>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                style={{ ...pillBtn, background: "#16A34A", fontSize: 12, padding: "6px 14px" }}
                                onClick={() => confirmMatch(tx.id, tx.suggestion!)}
                              >
                                Confirm match
                              </button>
                              <button
                                style={{ ...ghostBtn, fontSize: 12, padding: "6px 14px" }}
                                onClick={() => rejectLikely(tx.id)}
                              >
                                Not this invoice
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Expanded: unmatched */}
                        {isOpen && tx.state === "unmatched" && (
                          <div style={{
                            margin: "0 18px 14px", padding: "14px 16px",
                            background: "#FEF2F2", border: "1px solid #FECACA",
                            borderRadius: 10,
                          }}>
                            <p style={{ fontSize: 12, color: "#991B1B", fontWeight: 600, marginBottom: 8 }}>
                              Search open invoices to match this payment
                            </p>
                            <input
                              type="text"
                              placeholder="Search by reference or customer…"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              style={{
                                width: "100%", boxSizing: "border-box",
                                border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8,
                                padding: "7px 12px", fontSize: 12.5, marginBottom: 10,
                                background: "#FFFFFF", color: "#1A1916", outline: "none",
                              }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {filteredInvoices.map((inv) => (
                                <div
                                  key={inv.ref}
                                  onClick={() => confirmMatch(tx.id, inv.ref)}
                                  style={{
                                    display: "flex", justifyContent: "space-between", alignItems: "center",
                                    padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                                    background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)",
                                    fontSize: 12.5,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F4F5")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
                                >
                                  <div>
                                    <span style={{ fontWeight: 600, color: "#1A1916", marginRight: 8 }}>{inv.ref}</span>
                                    <span style={{ color: "#8A8680" }}>{inv.customer}</span>
                                  </div>
                                  <span style={{ color: "#1A1916", fontWeight: 600 }}>{fmtGBP(inv.amount)}</span>
                                </div>
                              ))}
                              {filteredInvoices.length === 0 && (
                                <p style={{ fontSize: 12, color: "#8A8680", textAlign: "center", padding: "8px 0" }}>No invoices match your search.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
          background: "#1A1916", color: "#FFFFFF",
          padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)", zIndex: 100,
          whiteSpace: "nowrap",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Match pill
// ---------------------------------------------------------------------------
function MatchPill({ tx }: { tx: Tx }) {
  const styles: Record<TxState, React.CSSProperties> = {
    matched:   { background: "#F0FDF4", color: "#16A34A", border: "1px solid #86EFAC" },
    likely:    { background: "#FFFBEB", color: "#C28800", border: "1px solid #FDE68A", cursor: "pointer" },
    unmatched: { background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", cursor: "pointer" },
    outgoing:  { background: "#F4F4F5", color: "#8A8680", border: "1px solid rgba(0,0,0,0.1)" },
  };

  const labels: Record<TxState, string> = {
    matched:   `● Matched: ${tx.matched ?? ""}`,
    likely:    `● Likely: ${tx.customer ?? tx.suggestion ?? ""}`,
    unmatched: "● Unmatched",
    outgoing:  `● ${tx.category ?? "Outgoing"}`,
  };

  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      whiteSpace: "nowrap",
      ...styles[tx.state],
    }}>
      {labels[tx.state]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
function KpiCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: "16px 20px" }}>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8A8680", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? "#1A1916", marginTop: 8, marginBottom: 0 }}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  overflow: "hidden",
};

const pillBtn: React.CSSProperties = {
  background: "#1A1916", color: "#FFFFFF",
  border: "none", borderRadius: 999,
  padding: "8px 18px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", whiteSpace: "nowrap",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent", color: "#1A1916",
  border: "1px solid rgba(0,0,0,0.15)", borderRadius: 999,
  padding: "8px 18px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", whiteSpace: "nowrap",
};
