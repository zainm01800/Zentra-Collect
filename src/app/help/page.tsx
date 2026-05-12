import { PageHeader } from "@/components/page-header";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & support",
  description: "How Zentra Collect ranks, what human review means, and how to get help.",
};

const faqs = [
  {
    q: "How does Zentra Collect decide who to chase first?",
    a: "Deterministic rules — invoice age, amount, customer payment history, dispute status, and whether a promise is in play. AI is only used to draft messages and classify replies, never to rank.",
  },
  {
    q: "Will Zentra Collect ever send messages automatically?",
    a: "No. Every outbound message requires you to review the draft, the safety checks, and copy or send it from your own inbox. That's the safety promise.",
  },
  {
    q: "What happens to a customer in dispute?",
    a: "They drop out of the chase queue automatically and into Disputes. Once you mark the dispute resolved, Zentra Collect resumes the appropriate chase action.",
  },
  {
    q: "Where does the data come from?",
    a: "CSV/XLSX export from your accounting tool — Xero, QuickBooks, Sage, or anything that exports an AR ageing report or unpaid invoice list.",
  },
];

export default function HelpPage() {
  return (
    <div className="flex flex-col gap-5">
        <PageHeader
          kicker="Help & support"
          title="How Zentra Collect works"
          sub="Quick answers about the decisioning engine, safety rules, and import. For anything else, get in touch."
          actions={
            <>
              <a href="mailto:support@zentracollect.co.uk" className="zn-pill">Contact support</a>
            </>
          }
        />

        {/* How Zentra ranks — make the rules-first promise visible */}
        <div className="zn-card p-6 lg:p-7">
          <div className="zn-label !p-0 mb-1.5">How Zentra Collect ranks</div>
          <h2
            className="text-[22px] tracking-[-0.015em] leading-[1.1] text-[#1d1813] dark:text-[#f0e8d5] mb-4"
            style={{ fontFamily: "var(--font-newsreader), ui-serif, Georgia, serif", fontWeight: 500 }}
          >
            We tell you why.
          </h2>
          <p className="text-[13.5px] leading-relaxed text-[#6b6253] dark:text-[#8a7d69] max-w-[720px] mb-5">
            Every invoice gets a priority score from 0–100 based on a small set
            of deterministic signals. Same input, same output, every time —
            you can audit the result.
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { weight: "× 8.0", signal: "Days overdue",       sub: "Older invoices score higher; sharp jump after 60 days." },
              { weight: "× 0.5", signal: "Amount outstanding",  sub: "Bigger balances move the needle more on cash recovery." },
              { weight: "× 1.5", signal: "Prior chase count",   sub: "Each unanswered chase escalates the recommended action." },
              { weight: "× 2.0", signal: "Customer history",    sub: "Late payers / disputed in past 12 months get extra weight." },
              { weight: "× 1.0", signal: "Open invoice count",  sub: "Customers with multiple open items often need a statement." },
              { weight: "Block", signal: "Active dispute",      sub: "Disputed invoices drop out of chase recommendations." },
            ].map((row) => (
              <div
                key={row.signal}
                className="rounded-[10px] p-3.5"
                style={{
                  background: "var(--zn-surface-2)",
                  border: "1px solid var(--zn-line-soft)",
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-semibold text-[#1d1813] dark:text-[#f0e8d5]">{row.signal}</span>
                  <span
                    className="text-[10.5px] tabular-nums"
                    style={{
                      fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                      color: "var(--zn-accent)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {row.weight}
                  </span>
                </div>
                <p className="text-[12px] leading-[1.5]" style={{ color: "var(--zn-ink-3)" }}>
                  {row.sub}
                </p>
              </div>
            ))}
          </div>

          <div
            className="mt-5 rounded-[10px] p-3.5 text-[12.5px] leading-relaxed"
            style={{
              background: "var(--zn-ink)",
              color: "var(--zn-surface)",
            }}
          >
            <span style={{ color: "rgba(250,245,232,0.55)" }}>AI is used for three things only: </span>
            drafting the body of your message, classifying customer replies, and
            suggesting column mappings on import. <span style={{ color: "rgba(250,245,232,0.55)" }}>You confirm each one. Ranking, scenario selection, and safety checks are 100% rule-based.</span>
          </div>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-2">
          {faqs.map((f) => (
            <div key={f.q} className="zn-card p-5">
              <h3 className="text-[14px] font-semibold mb-2 text-[#1d1813] dark:text-[#f0e8d5]">{f.q}</h3>
              <p className="text-[13px] leading-relaxed text-[#6b6253] dark:text-[#8a7d69]">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
  );
}
