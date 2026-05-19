/**
 * Shared demo expenses data — imported by both the demo Expenses page and
 * the demo Tax & VAT page so both always show consistent totals.
 */

export interface VatLine {
  label:       string;
  net:         number;
  vatRate:     number; // 20 | 5 | 0 | -1 (exempt/outside scope)
  vat:         number;
  gross:       number;
  reclaimable: boolean;
}

export interface DemoExpense {
  id:          string;
  date:        string;
  description: string;
  category:    string;
  hasReceipt:  boolean;
  vatLines:    VatLine[];
}

// allowablePct by category (mirrors CATEGORY_META in the expenses page)
const ALLOWABLE_PCT: Record<string, number> = {
  "Software":              100,
  "Office":                100,
  "Travel":                100,
  "Communications":         50,
  "Insurance":             100,
  "Entertaining":            0,
  "Professional Services": 100,
  "Marketing":             100,
  "Equipment":             100,
};

// vatClaimable by category
const VAT_CLAIMABLE: Record<string, boolean> = {
  "Software":              true,
  "Office":                true,
  "Travel":                false,
  "Communications":        true,
  "Insurance":             false,
  "Entertaining":          false,
  "Professional Services": true,
  "Marketing":             true,
  "Equipment":             true,
};

export const BASE_EXPENSES: DemoExpense[] = [
  {
    id: "e-1", date: "2026-05-12", description: "Adobe Creative Cloud",
    category: "Software", hasReceipt: true,
    vatLines: [{ label: "Monthly subscription", net: 49.99, vatRate: 20, vat: 10.00, gross: 59.99, reclaimable: true }],
  },
  {
    id: "e-2", date: "2026-05-10", description: "Client lunch — BluePeak",
    category: "Entertaining", hasReceipt: false,
    vatLines: [{ label: "Restaurant bill", net: 68.00, vatRate: 20, vat: 13.60, gross: 81.60, reclaimable: false }],
  },
  {
    id: "e-3", date: "2026-05-08", description: "Hotel — London client meeting",
    category: "Travel", hasReceipt: true,
    vatLines: [
      { label: "Room (1 night)",    net: 160.00, vatRate: 20, vat: 32.00, gross: 192.00, reclaimable: true },
      { label: "Breakfast",         net:  12.00, vatRate: 20, vat:  2.40, gross:  14.40, reclaimable: true },
      { label: "Parking (on-site)", net:  18.00, vatRate: -1, vat:  0.00, gross:  18.00, reclaimable: false },
    ],
  },
  {
    id: "e-4", date: "2026-05-07", description: "Office supplies — Ryman",
    category: "Office", hasReceipt: true,
    vatLines: [{ label: "Stationery and supplies", net: 24.50, vatRate: 20, vat: 4.90, gross: 29.40, reclaimable: true }],
  },
  {
    id: "e-5", date: "2026-04-28", description: "Broadband — BT Business",
    category: "Communications", hasReceipt: true,
    vatLines: [{ label: "Monthly broadband", net: 42.00, vatRate: 20, vat: 8.40, gross: 50.40, reclaimable: true }],
  },
  {
    id: "e-6", date: "2026-04-22", description: "Train — London client visit",
    category: "Travel", hasReceipt: false,
    vatLines: [{ label: "Return rail ticket", net: 87.40, vatRate: 0, vat: 0.00, gross: 87.40, reclaimable: false }],
  },
  {
    id: "e-7", date: "2026-04-18", description: "GitHub Pro",
    category: "Software", hasReceipt: true,
    vatLines: [{ label: "Annual plan (monthly)", net: 3.99, vatRate: 20, vat: 0.80, gross: 4.79, reclaimable: true }],
  },
  {
    id: "e-8", date: "2026-04-15", description: "Printer ink cartridges",
    category: "Office", hasReceipt: false,
    vatLines: [{ label: "Ink cartridges ×4", net: 31.20, vatRate: 20, vat: 6.24, gross: 37.44, reclaimable: true }],
  },
  {
    id: "e-9", date: "2026-04-09", description: "Mobile phone bill",
    category: "Communications", hasReceipt: true,
    vatLines: [{ label: "Monthly contract", net: 35.00, vatRate: 20, vat: 7.00, gross: 42.00, reclaimable: true }],
  },
  {
    id: "e-10", date: "2026-04-05", description: "Professional indemnity ins.",
    category: "Insurance", hasReceipt: true,
    vatLines: [{ label: "Annual premium", net: 220.00, vatRate: -1, vat: 0.00, gross: 220.00, reclaimable: false }],
  },
  {
    id: "e-11", date: "2026-04-02", description: "Canva Pro subscription",
    category: "Software", hasReceipt: false,
    vatLines: [{ label: "Annual plan", net: 9.99, vatRate: 20, vat: 2.00, gross: 11.99, reclaimable: true }],
  },
  {
    id: "e-12", date: "2026-03-28", description: "Google Ads — March",
    category: "Marketing", hasReceipt: true,
    vatLines: [{ label: "Paid search ads", net: 180.00, vatRate: 20, vat: 36.00, gross: 216.00, reclaimable: true }],
  },
  {
    id: "e-13", date: "2026-03-20", description: "Accountant — Q4 filing",
    category: "Professional Services", hasReceipt: true,
    vatLines: [{ label: "Quarterly bookkeeping + filing", net: 350.00, vatRate: 20, vat: 70.00, gross: 420.00, reclaimable: true }],
  },
  {
    id: "e-14", date: "2026-05-01", description: "Electricity — office supply",
    category: "Office", hasReceipt: true,
    vatLines: [
      { label: "Units consumed (reduced rate 5%)",    net: 85.00, vatRate:  5, vat:  4.25, gross:  89.25, reclaimable: true },
      { label: "Standing charge (standard rate 20%)", net: 15.00, vatRate: 20, vat:  3.00, gross:  18.00, reclaimable: true },
    ],
  },
  {
    id: "e-15", date: "2026-04-25", description: "Conference catering — team day",
    category: "Marketing", hasReceipt: true,
    vatLines: [
      { label: "Cold sandwiches & buffet (zero-rated)", net: 120.00, vatRate:  0, vat:  0.00, gross: 120.00, reclaimable: false },
      { label: "Hot drinks & coffee (standard 20%)",    net:  30.00, vatRate: 20, vat:  6.00, gross:  36.00, reclaimable: true },
      { label: "Room hire (standard 20%)",              net:  80.00, vatRate: 20, vat: 16.00, gross:  96.00, reclaimable: true },
    ],
  },
];

function r2(n: number) { return Math.round(n * 100) / 100; }

/** Pre-computed totals from the default (unedited) demo expenses dataset. */
export const DEMO_EXPENSES_TOTALS = (() => {
  let totalGross        = 0;
  let totalAllowNet     = 0;
  let totalConfirmedVat = 0;
  let totalPendingVat   = 0;
  let totalDisallowed   = 0;

  for (const e of BASE_EXPENSES) {
    const pct        = ALLOWABLE_PCT[e.category] ?? 100;
    const vatOk      = VAT_CLAIMABLE[e.category] ?? true;
    const net        = r2(e.vatLines.reduce((s, l) => s + l.net,   0));
    const gross      = r2(e.vatLines.reduce((s, l) => s + l.gross, 0));
    const allowNet   = r2(net * pct / 100);
    const reclaimVat = vatOk ? r2(e.vatLines.filter(l => l.reclaimable).reduce((s, l) => s + l.vat, 0) * pct / 100) : 0;

    totalGross        += gross;
    totalAllowNet     += allowNet;
    totalDisallowed   += net - allowNet;
    if (e.hasReceipt) totalConfirmedVat += reclaimVat;
    else               totalPendingVat  += reclaimVat;
  }

  return {
    totalGross:        r2(totalGross),
    totalAllowNet:     r2(totalAllowNet),
    totalConfirmedVat: r2(totalConfirmedVat),
    totalPendingVat:   r2(totalPendingVat),
    totalDisallowed:   r2(totalDisallowed),
    taxSaving20:       r2(r2(totalAllowNet) * 0.20),
  };
})();
