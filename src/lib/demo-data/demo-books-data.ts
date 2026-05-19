/**
 * src/lib/demo-data/demo-books-data.ts
 *
 * Demo data for /demo/* books pages. All entities belong to the same
 * fictional business — Acme Studio Ltd (a creative agency in Reading) —
 * and reference the same customers and invoice numbers visible in the
 * chase plan (/demo/chase-plan) and customer list (/demo/customers).
 *
 * Invoice numbers referenced here (ACM-XXXX) match those in
 * src/lib/demo-data/zentra-demo-data.ts exactly.
 *
 * Dates fall inside the 2026/27 UK tax year.
 */

// ── Mileage ───────────────────────────────────────────────────────────────────
// Trips to actual Acme Studio clients. Total 349 miles matches the mileage
// page headline stats (45p × 349 = £157.05).

export interface DemoMileageTrip {
  id:       string;
  date:     string;
  miles:    number;
  purpose:  string;
  fromTo?:  string;
}

export const demoMileageTrips: DemoMileageTrip[] = [
  { id: "dm-1", date: "2026-05-12", miles:  42, purpose: "Client review — BrightPath Media Ltd",  fromTo: "Reading → London" },
  { id: "dm-2", date: "2026-05-08", miles:  18, purpose: "Studio visit — Atlas IT Support",        fromTo: "Reading → Slough" },
  { id: "dm-3", date: "2026-04-22", miles:  67, purpose: "Workshop — Northline Creative",          fromTo: "Reading → Oxford" },
  { id: "dm-4", date: "2026-04-18", miles: 110, purpose: "Trade show — Birmingham NEC",            fromTo: "Reading → Birmingham" },
  { id: "dm-5", date: "2026-04-11", miles:  24, purpose: "Site visit — Riverbank Studios",         fromTo: "Reading → Wokingham" },
  { id: "dm-6", date: "2026-04-07", miles:  88, purpose: "New business pitch — Greenstone Consulting", fromTo: "Reading → Guildford" },
];
// Total: 349 miles × 45p = £157.05

// ── Quotes ────────────────────────────────────────────────────────────────────
// Quotes raised for Acme Studio clients. QTE-007 is marked "converted" and
// corresponds to invoice ACM-1052 (Riverbank Studios, £1,200) on the chase plan.

export interface DemoQuote {
  id:            string;
  quoteNumber:   string;
  customerName:  string;
  customerEmail?: string;
  issueDate:     string;
  expiresOn?:    string;
  status:        "draft" | "sent" | "accepted" | "declined" | "converted";
  amountNet:     number;
  vatRate:       number;
  vatAmount:     number;
  amountGross:   number;
  description:   string;
  notes?:        string;
}

export const demoQuotes: DemoQuote[] = [
  {
    id: "dq-1", quoteNumber: "QTE-009",
    customerName: "BrightPath Media Ltd", customerEmail: "accounts@brightpathmedia.co.uk",
    issueDate: "2026-05-10", expiresOn: "2026-06-10",
    status: "sent",
    amountNet: 4_200, vatRate: 20, vatAmount: 840, amountGross: 5_040,
    description: "Brand asset library + guidelines refresh — 14 deliverables",
  },
  {
    id: "dq-2", quoteNumber: "QTE-008",
    customerName: "Atlas IT Support", customerEmail: "payments@atlasitsupport.co.uk",
    issueDate: "2026-05-02", expiresOn: "2026-06-02",
    status: "accepted",
    amountNet: 3_000, vatRate: 20, vatAmount: 600, amountGross: 3_600,
    description: "Website redesign — phase 1 (discovery + wireframes)",
  },
  {
    id: "dq-3", quoteNumber: "QTE-007",
    customerName: "Riverbank Studios", customerEmail: "hello@riverbankstudios.co.uk",
    issueDate: "2026-04-05", expiresOn: "2026-05-05",
    status: "converted",
    // Gross matches invoice ACM-1052 on the chase plan (£1,200)
    amountNet: 1_000, vatRate: 20, vatAmount: 200, amountGross: 1_200,
    description: "Q2 social media & content retainer — 3 months",
  },
  {
    id: "dq-4", quoteNumber: "QTE-006",
    customerName: "Northline Creative", customerEmail: "finance@northlinecreative.co.uk",
    issueDate: "2026-04-20", expiresOn: "2026-05-20",
    status: "draft",
    amountNet: 950, vatRate: 20, vatAmount: 190, amountGross: 1_140,
    description: "Photography day + post-production (half-day shoot)",
  },
  {
    id: "dq-5", quoteNumber: "QTE-005",
    customerName: "Greenstone Consulting", customerEmail: "ap@greenstoneconsulting.co.uk",
    issueDate: "2026-04-12",
    status: "declined",
    amountNet: 1_500, vatRate: 20, vatAmount: 300, amountGross: 1_800,
    description: "Brand strategy workshop — full day facilitation",
    notes: "Client decided to handle in-house following budget review.",
  },
];

// ── Credit notes ──────────────────────────────────────────────────────────────
// Raised against actual Acme Studio invoice numbers from the chase plan.

export interface DemoCreditNote {
  id:               string;
  creditNoteNumber: string;
  customerName:     string;
  invoiceNumber?:   string;
  issueDate:        string;
  reason:           string;
  amountNet:        number;
  vatRate:          number;
  vatAmount:        number;
  amountGross:      number;
}

export const demoCreditNotes: DemoCreditNote[] = [
  {
    id: "dcn-1", creditNoteNumber: "CN-003",
    customerName: "Greenstone Consulting",
    // ACM-1015 is the disputed invoice ("final workshop not delivered")
    invoiceNumber: "ACM-1015",
    issueDate: "2026-05-03",
    reason: "Partial credit — workshop scope reduced by agreement",
    amountNet: 300, vatRate: 20, vatAmount: 60, amountGross: 360,
  },
  {
    id: "dcn-2", creditNoteNumber: "CN-002",
    customerName: "BrightPath Media Ltd",
    // ACM-1047 is the overdue invoice for BrightPath
    invoiceNumber: "ACM-1047",
    issueDate: "2026-04-25",
    reason: "Correction — print asset charge invoiced in error",
    amountNet: 200, vatRate: 20, vatAmount: 40, amountGross: 240,
  },
  {
    id: "dcn-3", creditNoteNumber: "CN-001",
    customerName: "Northline Creative",
    // ACM-1033 is the overdue invoice for Northline
    invoiceNumber: "ACM-1033",
    issueDate: "2026-04-14",
    reason: "Cancellation — strategy day postponed by client",
    amountNet: 500, vatRate: 0, vatAmount: 0, amountGross: 500,
  },
];

// ── Bank feed / direct income ─────────────────────────────────────────────────
// demoDirectIncome: smaller non-invoiced payments (freelance days, consultations)
// used by the tax page to add to the invoiced income total.
//
// demoBankCredits: everything visible in the bank feed, including the above
// (tagged: true) plus two untagged client payments the visitor can link up —
// one is clearly Atlas IT's payment of ACM-1060 (the invoice marked "paid"
// on the chase plan), the other is a BrightPath payment.

export interface DemoDirectIncomeEntry {
  transactionId: string;
  amount:        number;
  date:          string;
  description:   string;
  category:      "services" | "products" | "rental" | "interest" | "other";
}

export const demoDirectIncome: DemoDirectIncomeEntry[] = [
  { transactionId: "dt-1", amount: 480, date: "2026-05-12", description: "FPS · N PATEL · FREELANCE DESIGN DAY",    category: "services" },
  { transactionId: "dt-2", amount: 240, date: "2026-05-09", description: "BACS · S TURNER · BRAND CONSULTATION",    category: "services" },
  { transactionId: "dt-3", amount: 120, date: "2026-05-05", description: "BACS · A GARCIA · LOGO REVISION",         category: "services" },
  { transactionId: "dt-4", amount: 360, date: "2026-04-28", description: "FPS · D WRIGHT · STRATEGY SESSION",       category: "services" },
  { transactionId: "dt-5", amount: 180, date: "2026-04-20", description: "BACS · J WALSH · CV DESIGN",              category: "services" },
];
// Total direct income: £1,380

export interface DemoBankCredit {
  transactionId: string;
  amount:        number;
  date:          string;
  description:   string;
  tagged:        boolean;
}

export const demoBankCredits: DemoBankCredit[] = [
  // Already tagged — the five direct-income entries above
  ...demoDirectIncome.map((e) => ({
    transactionId: e.transactionId,
    amount:        e.amount,
    date:          e.date,
    description:   e.description,
    tagged:        true,
  })),
  // Untagged — recognisable client payments the visitor can link up.
  // dt-6 matches invoice ACM-1060 (Atlas IT Support, £850, status: paid on chase plan).
  { transactionId: "dt-6", amount: 850, date: "2026-05-14", description: "BACS · ATLAS IT SUPPORT LTD · REF ACM-1060",  tagged: false },
  // dt-7 is a BrightPath Media credit — likely a deposit or partial payment.
  { transactionId: "dt-7", amount: 960, date: "2026-05-15", description: "FPS · BRIGHTPATH MEDIA LTD",                  tagged: false },
];
