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
  vendor:      string;
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
    id: "e-1", date: "2026-05-14", description: "Figma — Organisation plan",
    vendor: "Figma, Inc.", category: "Software", hasReceipt: true,
    vatLines: [{ label: "Figma — Organisation plan", net: 450.00, vatRate: 20, vat: 90.00, gross: 540.00, reclaimable: true }],
  },
  {
    id: "e-2", date: "2026-05-12", description: "Eurostar — London → Paris",
    vendor: "Eurostar Intl.", category: "Travel", hasReceipt: true,
    vatLines: [{ label: "Return business travel", net: 312.50, vatRate: 0, vat: 0.00, gross: 312.50, reclaimable: false }],
  },
  {
    id: "e-3", date: "2026-05-11", description: "Dinner — Sequoia partners",
    vendor: "The Quality Chop House", category: "Entertaining", hasReceipt: false,
    vatLines: [{ label: "Restaurant bill", net: 153.50, vatRate: 20, vat: 30.70, gross: 184.20, reclaimable: false }],
  },
  {
    id: "e-4", date: "2026-05-09", description: "BP Connect — Fuel",
    vendor: "BP plc", category: "Travel", hasReceipt: false,
    vatLines: [{ label: "Fuel (business mileage)", net: 52.00, vatRate: 20, vat: 10.40, gross: 62.40, reclaimable: true }],
  },
  {
    id: "e-5", date: "2026-05-07", description: "Meta Ads — Q2 awareness push",
    vendor: "Meta Platforms Ireland", category: "Marketing", hasReceipt: true,
    vatLines: [{ label: "Paid social advertising", net: 1033.33, vatRate: 20, vat: 206.67, gross: 1240.00, reclaimable: true }],
  },
  {
    id: "e-6", date: "2026-05-06", description: "Paperchase — notebooks & pens",
    vendor: "Paperchase Ltd.", category: "Office", hasReceipt: true,
    vatLines: [{ label: "Stationery", net: 32.46, vatRate: 20, vat: 6.49, gross: 38.95, reclaimable: true }],
  },
  {
    id: "e-7", date: "2026-05-04", description: "Wimbledon hospitality box",
    vendor: "AELTC", category: "Entertaining", hasReceipt: true,
    vatLines: [{ label: "Corporate hospitality", net: 2000.00, vatRate: 20, vat: 400.00, gross: 2400.00, reclaimable: false }],
  },
  {
    id: "e-8", date: "2026-05-02", description: "British Gas — office utilities",
    vendor: "British Gas", category: "Office", hasReceipt: true,
    vatLines: [
      { label: "Energy units (reduced rate)",  net: 123.80, vatRate:  5, vat:  6.19, gross: 129.99, reclaimable: true },
      { label: "Standing charge (standard)",   net:  15.27, vatRate: 20, vat:  3.05, gross:  18.32, reclaimable: true },
    ],
  },
  {
    id: "e-9", date: "2026-04-28", description: "Apple — MacBook Pro 14\"",
    vendor: "Apple UK Ltd.", category: "Equipment", hasReceipt: true,
    vatLines: [{ label: "MacBook Pro 14\" M4", net: 1999.17, vatRate: 20, vat: 399.83, gross: 2399.00, reclaimable: true }],
  },
  {
    id: "e-10", date: "2026-04-22", description: "Linear — annual seats",
    vendor: "Linear Orbit, Inc.", category: "Software", hasReceipt: true,
    vatLines: [{ label: "Annual team seats", net: 990.00, vatRate: 20, vat: 198.00, gross: 1188.00, reclaimable: true }],
  },
  {
    id: "e-11", date: "2026-04-18", description: "Heathrow Express — return",
    vendor: "Heathrow Express", category: "Travel", hasReceipt: false,
    vatLines: [{ label: "Return rail ticket", net: 45.83, vatRate: 20, vat: 9.17, gross: 55.00, reclaimable: true }],
  },
  {
    id: "e-12", date: "2026-04-11", description: "Notion — team plan",
    vendor: "Notion Labs", category: "Software", hasReceipt: true,
    vatLines: [{ label: "Team plan (annual)", net: 160.00, vatRate: 20, vat: 32.00, gross: 192.00, reclaimable: true }],
  },
  {
    id: "e-13", date: "2026-04-04", description: "Lunch — design contractor",
    vendor: "Dishoom Shoreditch", category: "Entertaining", hasReceipt: true,
    vatLines: [{ label: "Lunch bill", net: 80.42, vatRate: 20, vat: 16.08, gross: 96.50, reclaimable: false }],
  },
  {
    id: "e-14", date: "2026-03-28", description: "Google Ads — March",
    vendor: "Google Ireland Ltd.", category: "Marketing", hasReceipt: true,
    vatLines: [{ label: "Paid search advertising", net: 180.00, vatRate: 20, vat: 36.00, gross: 216.00, reclaimable: true }],
  },
  {
    id: "e-15", date: "2026-03-20", description: "Accountant — Q4 filing",
    vendor: "Matthews & Co. Accountants", category: "Professional Services", hasReceipt: true,
    vatLines: [{ label: "Quarterly bookkeeping + filing", net: 350.00, vatRate: 20, vat: 70.00, gross: 420.00, reclaimable: true }],
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
