/**
 * src/lib/demo-data/demo-ar-data.ts
 *
 * Single source of truth for demo AR (accounts-receivable) data.
 * Consumed by: /demo/customers, /demo/aged-debt, /demo/page (dashboard).
 * Any page that needs customer balances, invoice lists, or risk info should
 * import from here — never maintain a parallel copy.
 */

export interface DemoARInvoice {
  ref:     string;
  amount:  number;
  overdue: number; // 0 = current/not overdue
  status:  "Final notice" | "Action now" | "Follow up" | "Current";
}

export interface DemoARCustomer {
  id:            string;
  name:          string;
  contact:       string;
  role:          string;
  email:         string;
  phone:         string;
  type:          string;
  location:      string;
  since:         string;
  relationship:  "regular" | "slow" | "problem" | "new";
  riskLevel:     1 | 2 | 3 | 4 | 5;
  riskLabel:     string;
  outstanding:   number;
  openInvoices:  number;
  maxOverdue:    number;
  avgPaymentDays:number;
  paidOnTime:    number;
  paidLate:      number;
  invoices:      DemoARInvoice[];
  riskFactors:   string[];
  notes:         string;
}

export const DEMO_AR_CUSTOMERS: DemoARCustomer[] = [
  {
    id: "pemberton", name: "Pemberton & Co", contact: "James Pemberton", role: "Managing Director",
    email: "j.pemberton@pemberton-co.uk", phone: "+44 121 555 0167",
    type: "Family-office advisory", location: "Birmingham, UK", since: "Nov 2021",
    relationship: "problem", riskLevel: 5, riskLabel: "Critical risk",
    outstanding: 23750, openInvoices: 4, maxOverdue: 112, avgPaymentDays: 78, paidOnTime: 6, paidLate: 11,
    invoices: [
      { ref: "INV-2026-0098", amount: 9500,  overdue: 112, status: "Final notice" },
      { ref: "INV-2026-0107", amount: 7250,  overdue: 94,  status: "Action now"   },
      { ref: "INV-2026-0124", amount: 4500,  overdue: 70,  status: "Action now"   },
      { ref: "INV-2026-0143", amount: 2500,  overdue: 41,  status: "Follow up"    },
    ],
    riskFactors: [
      "4 open invoices · oldest 112 days past due",
      "11 of 17 lifetime invoices paid late",
      "Avg 78-day payment vs Net-30 terms",
      "Statutory interest accruing on 3 invoices",
    ],
    notes: "Sent pre-action protocol letter on 12 May. James acknowledged but offered no payment date. Recommend credit hold and county-court letter prep.",
  },
  {
    id: "bluepeak", name: "BluePeak Ltd", contact: "Daniel Okafor", role: "Head of Finance",
    email: "accounts@bluepeak.ltd.uk", phone: "+44 161 555 0142",
    type: "Logistics SME", location: "Manchester, UK", since: "Aug 2024",
    relationship: "slow", riskLevel: 3, riskLabel: "Medium risk",
    outstanding: 17200, openInvoices: 3, maxOverdue: 31, avgPaymentDays: 43, paidOnTime: 4, paidLate: 2,
    invoices: [
      { ref: "INV-2026-0138", amount: 12250, overdue: 23, status: "Action now" },
      { ref: "INV-2026-0147", amount: 3200,  overdue: 31, status: "Follow up"  },
      { ref: "INV-2026-0152", amount: 1750,  overdue: 0,  status: "Current"    },
    ],
    riskFactors: [
      "2 of 6 invoices paid late in past 6 months",
      "Average 43-day payment vs Net-30 terms",
      "AP cycle runs on the 15th and end-of-month",
    ],
    notes: "AP team only processes runs on the 15th and end-of-month. Best to align invoice timing.",
  },
  {
    id: "oaktree", name: "Oaktree Consulting", contact: "Priya Raman", role: "Managing Partner",
    email: "priya@oaktree-consulting.com", phone: "+44 20 3964 7720",
    type: "Strategy consultancy", location: "London, UK", since: "Jun 2022",
    relationship: "regular", riskLevel: 2, riskLabel: "Low risk",
    outstanding: 11300, openInvoices: 2, maxOverdue: 47, avgPaymentDays: 26, paidOnTime: 20, paidLate: 1,
    invoices: [
      { ref: "INV-2026-0142", amount: 8400, overdue: 47, status: "Action now" },
      { ref: "INV-2026-0149", amount: 2900, overdue: 15, status: "Follow up"  },
    ],
    riskFactors: [
      "47-day overdue on INV-2026-0142 — unusually long for Oaktree",
      "20 of 21 lifetime invoices paid on time",
      "Past dispute resolved amicably in Sep 2025",
    ],
    notes: "Priya prefers direct calls over emails for anything over £5,000. Note to follow up the formal pre-action letter with a call.",
  },
  {
    id: "meridian", name: "Meridian Studio", contact: "Sarah Whitford", role: "Operations Director",
    email: "sarah.whitford@meridianstudio.co.uk", phone: "+44 20 7946 0118",
    type: "Design agency", location: "London, UK", since: "Mar 2023",
    relationship: "regular", riskLevel: 2, riskLabel: "Low risk",
    outstanding: 9900, openInvoices: 3, maxOverdue: 62, avgPaymentDays: 31, paidOnTime: 14, paidLate: 0,
    invoices: [
      { ref: "INV-2026-0153", amount: 2350, overdue: 62, status: "Action now"  },
      { ref: "INV-2026-0151", amount: 4800, overdue: 14, status: "Follow up"   },
      { ref: "INV-2026-0155", amount: 2750, overdue: 0,  status: "Current"     },
    ],
    riskFactors: [
      "Two unanswered reminders on INV-2026-0153 (62 days)",
      "Otherwise perfect 14-invoice on-time history",
      "Net-30 standard terms",
    ],
    notes: "Sarah is the right contact for finance queries. CFO change rumoured in Q3 — flag if payment cycle shifts.",
  },
  {
    id: "harrow", name: "Harrow Digital", contact: "Adeola Thompson", role: "Finance Manager",
    email: "finance@harrowdigital.io", phone: "+44 20 4538 7711",
    type: "Digital marketing", location: "London, UK", since: "Jan 2026",
    relationship: "new", riskLevel: 1, riskLabel: "Low risk",
    outstanding: 4200, openInvoices: 1, maxOverdue: 0, avgPaymentDays: 18, paidOnTime: 3, paidLate: 0,
    invoices: [
      { ref: "INV-2026-0158", amount: 4200, overdue: 0, status: "Current" },
    ],
    riskFactors: [
      "New client — 3 invoices to date, all paid within 18 days",
      "Net-14 terms requested",
      "No outstanding queries",
    ],
    notes: "Onboarded Jan 2026. Quick payer so far — keep an eye as volume scales in Q3.",
  },
];

// ── Derived aggregates (used by dashboard KPIs and aged-debt totals) ──────────
export const DEMO_AR_TOTALS = {
  totalOutstanding: DEMO_AR_CUSTOMERS.reduce((s, c) => s + c.outstanding, 0),
  totalOverdue: DEMO_AR_CUSTOMERS.reduce(
    (s, c) => s + c.invoices.filter((i) => i.overdue > 0).reduce((a, i) => a + i.amount, 0),
    0
  ),
  overdueCount: DEMO_AR_CUSTOMERS.reduce(
    (s, c) => s + c.invoices.filter((i) => i.overdue > 0).length,
    0
  ),
  oldestOverdue: Math.max(...DEMO_AR_CUSTOMERS.map((c) => c.maxOverdue)),
  customerCount: DEMO_AR_CUSTOMERS.length,
};

export type DemoARRelationship = DemoARCustomer["relationship"];
