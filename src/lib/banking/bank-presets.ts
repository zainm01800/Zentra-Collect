/**
 * src/lib/banking/bank-presets.ts
 *
 * Column-mapping presets for the 12 most common UK banks.
 * Used by the CSV import to auto-detect the bank and map columns
 * without the user having to manually specify which column is which.
 */

export interface BankPreset {
  name: string;
  /** Maps our internal field names to the exact column headers this bank uses */
  mappings: {
    date: string;
    description: string;
    merchant?: string;
    reference?: string;
    amount?: string;
    currency?: string;
  };
  /** Some banks split into separate debit/credit columns instead of a signed amount */
  debitColumn?: string;
  creditColumn?: string;
  /** Only import rows where this column equals this value (e.g. PayPal "Completed") */
  statusFilter?: { column: string; value: string };
}

export const BANK_PRESETS: Record<string, BankPreset> = {
  monzo: {
    name: "Monzo",
    mappings: {
      date:        "Date",
      merchant:    "Name",
      description: "Notes and #tags",
      amount:      "Amount",
      currency:    "Currency",
      reference:   "Type",
    },
  },
  starling: {
    name: "Starling",
    mappings: {
      date:        "Date",
      merchant:    "Counter Party",
      description: "Reference",
      amount:      "Amount (GBP)",
      reference:   "Type",
    },
  },
  revolut: {
    name: "Revolut",
    mappings: {
      date:        "Completed Date",
      merchant:    "Description",
      description: "Description",
      amount:      "Amount",
      currency:    "Currency",
      reference:   "Type",
    },
  },
  barclays: {
    name: "Barclays",
    mappings: {
      date:        "Date",
      merchant:    "Memo",
      description: "Memo",
      amount:      "Amount",
      reference:   "Number",
    },
  },
  hsbc: {
    name: "HSBC",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
      reference:   "Reference",
    },
    debitColumn:  "Debit",
    creditColumn: "Credit",
  },
  natwest: {
    name: "NatWest",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
      amount:      "Value",
      reference:   "Type",
    },
  },
  rbs: {
    name: "RBS",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
      amount:      "Value",
      reference:   "Type",
    },
  },
  lloyds: {
    name: "Lloyds",
    mappings: {
      date:        "Transaction Date",
      merchant:    "Transaction Description",
      description: "Transaction Description",
      reference:   "Transaction Type",
    },
    debitColumn:  "Debit Amount",
    creditColumn: "Credit Amount",
  },
  halifax: {
    name: "Halifax",
    mappings: {
      date:        "Date",
      merchant:    "Transaction Description",
      description: "Transaction Description",
    },
    debitColumn:  "Debit Amount",
    creditColumn: "Credit Amount",
  },
  santander: {
    name: "Santander",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
      amount:      "Amount",
    },
  },
  santander_split: {
    name: "Santander",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
    },
    debitColumn:  "Money Out",
    creditColumn: "Money In",
  },
  nationwide: {
    name: "Nationwide",
    mappings: {
      date:        "Date",
      merchant:    "Transactions",
      description: "Transactions",
      amount:      "Paid out",
    },
    debitColumn:  "Paid out",
    creditColumn: "Paid in",
  },
  tsb: {
    name: "TSB",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
    },
    debitColumn:  "Debit",
    creditColumn: "Credit",
  },
  metro: {
    name: "Metro Bank",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
      amount:      "Credit/Debit",
    },
  },
  firstdirect: {
    name: "First Direct",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
    },
    debitColumn:  "Debit",
    creditColumn: "Credit",
  },
  co_op: {
    name: "Co-op Bank",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
      amount:      "Amount",
    },
  },
  virgin: {
    name: "Virgin Money",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
      amount:      "Amount",
    },
  },
  paypal: {
    name: "PayPal",
    mappings: {
      date:        "Date",
      merchant:    "Name",
      description: "Type",
      amount:      "Net",
      currency:    "Currency",
      reference:   "Transaction ID",
    },
    statusFilter: { column: "Status", value: "Completed" },
  },
  amex: {
    name: "American Express",
    mappings: {
      date:        "Date",
      merchant:    "Description",
      description: "Description",
      amount:      "Amount",
      reference:   "Reference",
    },
  },
};

/**
 * Detect which bank exported this CSV, using header fingerprints first,
 * then falling back to the filename.
 *
 * Returns the preset key and preset, or undefined if unrecognised.
 */
export function detectBankPreset(
  headers: string[],
  fileNameHint = "",
): { key: string; preset: BankPreset; detectedFrom: "headers" | "filename" } | undefined {
  // Unique header combinations that identify each bank
  const FINGERPRINTS: Array<{ key: string; uniqueHeaders: string[] }> = [
    { key: "monzo",          uniqueHeaders: ["Name", "Notes and #tags"] },
    { key: "starling",       uniqueHeaders: ["Counter Party", "Spending Category"] },
    { key: "revolut",        uniqueHeaders: ["Started Date", "Completed Date", "State"] },
    { key: "lloyds",         uniqueHeaders: ["Transaction Date", "Debit Amount", "Credit Amount"] },
    { key: "halifax",        uniqueHeaders: ["Transaction Date", "Debit Amount", "Credit Amount"] },
    { key: "hsbc",           uniqueHeaders: ["Debit", "Credit", "Balance"] },
    { key: "natwest",        uniqueHeaders: ["Value", "Account Name", "Account Number"] },
    { key: "rbs",            uniqueHeaders: ["Value", "Account Name", "Account Number"] },
    { key: "paypal",         uniqueHeaders: ["TimeZone", "Gross", "Net", "From Email Address"] },
    { key: "amex",           uniqueHeaders: ["Reference", "Amount", "Description"] },
    { key: "barclays",       uniqueHeaders: ["Subcategory", "Memo"] },
    { key: "santander_split",uniqueHeaders: ["Description", "Money In", "Money Out", "Balance"] },
    { key: "santander",      uniqueHeaders: ["Description", "Amount", "Balance"] },
    { key: "nationwide",     uniqueHeaders: ["Transactions", "Paid in", "Paid out"] },
    { key: "tsb",            uniqueHeaders: ["Date", "Description", "Debit", "Credit", "Balance"] },
    { key: "metro",          uniqueHeaders: ["Date", "Description", "Credit/Debit"] },
    { key: "firstdirect",    uniqueHeaders: ["Date", "Description", "Debit", "Credit"] },
    { key: "co_op",          uniqueHeaders: ["Date", "Description", "Amount"] },
    { key: "virgin",         uniqueHeaders: ["Date", "Description", "Amount"] },
  ];

  const headerSet = new Set(headers);

  for (const { key, uniqueHeaders } of FINGERPRINTS) {
    const matches = uniqueHeaders.filter((h) => headerSet.has(h)).length;
    if (matches >= Math.ceil(uniqueHeaders.length * 0.6)) {
      const preset = BANK_PRESETS[key];
      if (preset) return { key, preset, detectedFrom: "headers" };
    }
  }

  // Filename fallback
  const lower = fileNameHint.toLowerCase();
  const FILE_KEYWORDS: Record<string, string> = {
    monzo: "monzo", starling: "starling", revolut: "revolut",
    barclays: "barclays", lloyds: "lloyds", hsbc: "hsbc",
    natwest: "natwest", halifax: "halifax", santander: "santander",
    paypal: "paypal", amex: "amex", "american express": "amex", rbs: "rbs",
    nationwide: "nationwide", tsb: "tsb", metro: "metro",
    firstdirect: "firstdirect", "first direct": "firstdirect",
    "co-op": "co_op", coop: "co_op", cooperative: "co_op",
    virgin: "virgin",
  };
  for (const [keyword, key] of Object.entries(FILE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      const preset = BANK_PRESETS[key];
      if (preset) return { key, preset, detectedFrom: "filename" };
    }
  }

  return undefined;
}
