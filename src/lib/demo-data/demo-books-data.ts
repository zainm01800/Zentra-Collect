/**
 * src/lib/demo-data/demo-books-data.ts
 *
 * Hardcoded fake data for the /demo/* books pages. None of this is
 * persisted, none of it is linked to any real account, and none of it
 * touches Supabase or localStorage. Demo pages import these constants
 * directly so signed-in and signed-out visitors see identical numbers.
 *
 * Dates are written as plain YYYY-MM-DD strings rather than computed
 * from "today" so the screenshots in marketing material stay stable.
 * They're set to fall inside the 2026/27 UK tax year so the tax-year
 * close demo shows meaningful figures.
 */

export interface DemoMileageTrip {
  id:        string;
  date:      string;
  miles:     number;
  purpose:   string;
  fromTo?:   string;
}

export const demoMileageTrips: DemoMileageTrip[] = [
  { id: "dm-1",  date: "2026-05-04", miles: 42,  purpose: "Site visit — BluePeak Studios",   fromTo: "Reading → Slough" },
  { id: "dm-2",  date: "2026-05-08", miles: 18,  purpose: "Client lunch — Acme Holdings",    fromTo: "Reading → Maidenhead" },
  { id: "dm-3",  date: "2026-04-22", miles: 67,  purpose: "Workshop delivery — Compass Co.", fromTo: "Reading → Oxford" },
  { id: "dm-4",  date: "2026-04-18", miles: 110, purpose: "Trade show — Birmingham NEC",     fromTo: "Reading → Birmingham" },
  { id: "dm-5",  date: "2026-04-12", miles: 24,  purpose: "Survey — Greenfield Ltd",         fromTo: "Reading → Bracknell" },
  { id: "dm-6",  date: "2026-04-07", miles: 88,  purpose: "Pitch — Lakeshore Marketing",     fromTo: "Reading → Cambridge" },
];

// Total: 349 miles × 0.45 = £157.05

export interface DemoQuote {
  id:           string;
  quoteNumber:  string;
  customerName: string;
  customerEmail?: string;
  issueDate:    string;
  expiresOn?:   string;
  status:       "draft" | "sent" | "accepted" | "declined" | "converted";
  amountNet:    number;
  vatRate:      number;
  vatAmount:    number;
  amountGross:  number;
  description:  string;
  notes?:       string;
}

export const demoQuotes: DemoQuote[] = [
  {
    id: "dq-1",  quoteNumber: "QTE-008",
    customerName: "Compass Co.", customerEmail: "ap@compassco.example",
    issueDate: "2026-05-10", expiresOn: "2026-06-10",
    status: "sent",
    amountNet: 4_200, vatRate: 20, vatAmount: 840, amountGross: 5_040,
    description: "Quarterly brand audit — 12 deliverables",
  },
  {
    id: "dq-2",  quoteNumber: "QTE-007",
    customerName: "BluePeak Studios",
    issueDate: "2026-05-02", expiresOn: "2026-06-02",
    status: "accepted",
    amountNet: 1_850, vatRate: 20, vatAmount: 370, amountGross: 2_220,
    description: "Photography session + retouching",
  },
  {
    id: "dq-3",  quoteNumber: "QTE-006",
    customerName: "Lakeshore Marketing",
    issueDate: "2026-04-28", expiresOn: "2026-05-28",
    status: "converted",
    amountNet: 6_500, vatRate: 20, vatAmount: 1_300, amountGross: 7_800,
    description: "Q2 retainer — content + paid social",
  },
  {
    id: "dq-4",  quoteNumber: "QTE-005",
    customerName: "Greenfield Ltd",
    issueDate: "2026-04-20", expiresOn: "2026-05-20",
    status: "draft",
    amountNet: 950, vatRate: 0, vatAmount: 0, amountGross: 950,
    description: "Half-day strategy workshop",
  },
  {
    id: "dq-5",  quoteNumber: "QTE-004",
    customerName: "Acme Holdings",
    issueDate: "2026-04-12",
    status: "declined",
    amountNet: 12_000, vatRate: 20, vatAmount: 2_400, amountGross: 14_400,
    description: "Website rebuild — phase 1",
    notes: "Client went with in-house solution.",
  },
];

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
    customerName: "Acme Holdings", invoiceNumber: "INV-2026-041",
    issueDate: "2026-05-03",
    reason: "Refund — duplicate billing for May retainer",
    amountNet: 500, vatRate: 20, vatAmount: 100, amountGross: 600,
  },
  {
    id: "dcn-2", creditNoteNumber: "CN-002",
    customerName: "BluePeak Studios", invoiceNumber: "INV-2026-038",
    issueDate: "2026-04-25",
    reason: "Cancellation — workshop postponed",
    amountNet: 1_200, vatRate: 20, vatAmount: 240, amountGross: 1_440,
  },
  {
    id: "dcn-3", creditNoteNumber: "CN-001",
    customerName: "Greenfield Ltd", invoiceNumber: "INV-2026-029",
    issueDate: "2026-04-14",
    reason: "Goodwill — late delivery on March milestone",
    amountNet: 350, vatRate: 0, vatAmount: 0, amountGross: 350,
  },
];

export interface DemoDirectIncomeEntry {
  transactionId: string;
  amount:        number;
  date:          string;
  description:   string;
  category:      "services" | "products" | "rental" | "interest" | "other";
}

export const demoDirectIncome: DemoDirectIncomeEntry[] = [
  { transactionId: "dt-1", amount: 240, date: "2026-05-12", description: "BACS · J COLLINS · DRIVING LESSON",   category: "services" },
  { transactionId: "dt-2", amount: 180, date: "2026-05-09", description: "FPS · M PATEL · BLOCK OF 4 LESSONS",   category: "services" },
  { transactionId: "dt-3", amount: 60,  date: "2026-05-05", description: "BACS · S TURNER · INTRO LESSON",       category: "services" },
  { transactionId: "dt-4", amount: 240, date: "2026-04-28", description: "BACS · A GARCIA · LESSON 8/10",        category: "services" },
  { transactionId: "dt-5", amount: 480, date: "2026-04-20", description: "FPS · D WRIGHT · MOCK TEST PACKAGE",   category: "services" },
];

// Mock bank-feed credits that haven't yet been tagged — the demo lets
// the visitor "tag" these to see the interaction (visually only — no
// state is persisted).
export interface DemoBankCredit {
  transactionId: string;
  amount:        number;
  date:          string;
  description:   string;
  /** Marked true in the demo for entries already shown as tagged. */
  tagged:        boolean;
}

export const demoBankCredits: DemoBankCredit[] = [
  ...demoDirectIncome.map((e) => ({
    transactionId: e.transactionId,
    amount:        e.amount,
    date:          e.date,
    description:   e.description,
    tagged:        true,
  })),
  { transactionId: "dt-6", amount: 120, date: "2026-05-15", description: "FPS · R AHMED · LESSON 3/6",          tagged: false },
  { transactionId: "dt-7", amount: 60,  date: "2026-05-14", description: "BACS · L WALSH · INTRO LESSON",       tagged: false },
];
