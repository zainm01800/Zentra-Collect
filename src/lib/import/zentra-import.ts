import type { CollectionStatus, Customer, Invoice } from "@/types/zentra";
import { calculateDaysOverdue } from "@/lib/collections/decision-engine";

export const importedInvoicesStorageKey = "zentra.importedInvoices.v1";
export const importSummaryStorageKey = "zentra.importSummary.v1";
export const importMappingTemplateStorageKey = "zentra.importMappingTemplate.v1";
export const importDiffStorageKey = "zentra.importDiff.v1";

export type ImportTargetField =
  | "customerName"
  | "customerEmail"
  | "invoiceNumber"
  | "dueDate"
  | "amountOutstanding"
  | "invoiceDate"
  | "originalAmount"
  | "status"
  | "paymentReference"
  | "notes"
  | "customerAccountNumber";

export type MappingConfidence = "high" | "medium" | "low" | "none";

export type SuggestedMapping = {
  field: ImportTargetField;
  sourceColumn: string;
  confidence: MappingConfidence;
  reason: string;
};

export type ImportValidationIssue = {
  id: string;
  severity: "error" | "warning";
  rowNumber?: number;
  field?: ImportTargetField;
  message: string;
};

export type ImportPreviewInvoice = {
  rowNumber: number;
  customerName: string;
  customerEmail?: string;
  invoiceNumber: string;
  dueDate: string;
  invoiceDate?: string;
  amountOutstanding: number;
  originalAmount: number;
  status: CollectionStatus;
  paymentReference?: string;
  notes?: string;
  customerAccountNumber?: string;
  daysOverdue: number;
};

export type ImportSummary = {
  importedAt: string;
  fileName: string;
  cashNeedingAttention: number;
  actionsRecommended: number;
  exceptions: number;
  invoiceCount: number;
  diff?: ImportDiffOutput;
};

export type ImportChangeType =
  | "paidSinceLastImport"
  | "newlyOverdue"
  | "stillOverdue"
  | "amountChanged"
  | "dueDateChanged"
  | "customerChanged"
  | "newlyAdded"
  | "removed"
  | "promisesMissed"
  | "disputesStillOpen"
  | "duplicateInvoices";

export type ImportChange = {
  id: string;
  type: ImportChangeType;
  invoiceNumber: string;
  customerName: string;
  amount?: number;
  previousAmount?: number;
  currentAmount?: number;
  previousValue?: string | number;
  currentValue?: string | number;
  message: string;
  severity: "info" | "attention" | "important";
};

export type ImportDiffOutput = {
  paidSinceLastImport: ImportChange[];
  newlyOverdue: ImportChange[];
  stillOverdue: ImportChange[];
  amountChanged: ImportChange[];
  dueDateChanged: ImportChange[];
  customerChanged: ImportChange[];
  newlyAdded: ImportChange[];
  removed: ImportChange[];
  promisesMissed: ImportChange[];
  disputesStillOpen: ImportChange[];
  duplicateInvoices: ImportChange[];
  totalPaidAmount: number;
  totalNewlyOverdueAmount: number;
  totalStillOutstanding: number;
  topChanges: ImportChange[];
  comparedAt: string;
  previousInvoiceCount: number;
  currentInvoiceCount: number;
};

const requiredFields: ImportTargetField[] = [
  "customerName",
  "invoiceNumber",
  "dueDate",
  "amountOutstanding",
];

export const importFieldLabels: Record<ImportTargetField, string> = {
  customerName: "Customer name",
  customerEmail: "Customer email",
  invoiceNumber: "Invoice number",
  dueDate: "Due date",
  amountOutstanding: "Amount outstanding",
  invoiceDate: "Invoice date",
  originalAmount: "Original amount",
  status: "Status",
  paymentReference: "Payment reference",
  notes: "Notes",
  customerAccountNumber: "Customer account number",
};

const synonyms: Record<ImportTargetField, string[]> = {
  customerName: [
    "customer",
    "contact",
    "contact name",
    "client",
    "organisation",
    "organization",
    "company",
    "customer name",
    "account name",
  ],
  customerEmail: [
    "email",
    "customer email",
    "contact email",
    "accounts email",
    "ap email",
    "billing email",
  ],
  invoiceNumber: [
    "invoice no",
    "invoice number",
    "invoice #",
    "invoice ref",
    "ref",
    "reference",
    "document number",
  ],
  dueDate: [
    "due date",
    "payment due",
    "due",
    "invoice due date",
    "date due",
  ],
  amountOutstanding: [
    "amount due",
    "balance",
    "outstanding",
    "remaining",
    "unpaid",
    "amount outstanding",
    "outstanding amount",
    "current balance",
  ],
  invoiceDate: ["invoice date", "date", "issued", "issue date", "tax date"],
  originalAmount: [
    "amount",
    "original amount",
    "invoice amount",
    "gross",
    "total",
    "invoice total",
  ],
  status: ["status", "invoice status", "state"],
  paymentReference: [
    "payment reference",
    "payment ref",
    "po",
    "po number",
    "purchase order",
    "reference",
  ],
  notes: ["notes", "memo", "description", "comments", "query", "dispute"],
  customerAccountNumber: [
    "account number",
    "customer account",
    "customer code",
    "account code",
    "customer id",
  ],
};

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && next === '"' && inQuotes) {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);

  const [headerRow = [], ...dataRows] = rows;
  return {
    headers: headerRow.map((header, index) => header || `Column ${index + 1}`),
    rows: dataRows.map((dataRow) => dataRow.map((cell) => cell.trim())),
  };
}

export function suggestColumnMappings(headers: string[]) {
  const used = new Set<string>();
  const mappings: Partial<Record<ImportTargetField, SuggestedMapping>> = {};

  for (const field of Object.keys(synonyms) as ImportTargetField[]) {
    const suggestion = findBestHeader(field, headers, used);
    if (suggestion.sourceColumn) used.add(suggestion.sourceColumn);
    mappings[field] = suggestion;
  }

  return mappings;
}

export async function requestAiAssistedMappingPlaceholder(headers: string[]) {
  void headers;
  // TODO: Add a server-side AI mapping endpoint for genuinely ambiguous exports.
  // The MVP keeps mapping deterministic so uploads work without an AI key.
  return null;
}

export function validateImport(
  rows: string[][],
  headers: string[],
  mappings: Partial<Record<ImportTargetField, string>>,
) {
  const issues: ImportValidationIssue[] = [];
  const preview: ImportPreviewInvoice[] = [];
  const invoiceNumbers = new Map<string, number>();

  for (const field of requiredFields) {
    if (!mappings[field]) {
      issues.push({
        id: `missing-${field}`,
        severity: "error",
        field,
        message: `We could not find a ${importFieldLabels[field].toLowerCase()} column. Please map one manually.`,
      });
    }
  }

  if (looksLikeApReport(headers)) {
    issues.push({
      id: "looks-like-ap",
      severity: "warning",
      message: "This file looks like a supplier/AP report, not customer invoices.",
    });
  }

  if (looksLikeCustomerList(headers, mappings)) {
    issues.push({
      id: "looks-like-customer-list",
      severity: "error",
      message: "This file looks like a customer list only. Zentra needs invoice numbers, due dates, and balances.",
    });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const customerName = valueFor(row, headers, mappings.customerName);
    const invoiceNumber = valueFor(row, headers, mappings.invoiceNumber);
    const dueDateRaw = valueFor(row, headers, mappings.dueDate);
    const invoiceDateRaw = valueFor(row, headers, mappings.invoiceDate);
    const outstandingRaw = valueFor(row, headers, mappings.amountOutstanding);
    const originalAmountRaw = valueFor(row, headers, mappings.originalAmount);
    const customerEmail = valueFor(row, headers, mappings.customerEmail);
    const statusRaw = valueFor(row, headers, mappings.status);
    const paymentReference = valueFor(row, headers, mappings.paymentReference);
    const notes = valueFor(row, headers, mappings.notes);
    const customerAccountNumber = valueFor(
      row,
      headers,
      mappings.customerAccountNumber,
    );

    if (!customerName) {
      issues.push({
        id: `row-${rowNumber}-customer`,
        severity: "error",
        rowNumber,
        field: "customerName",
        message: `Row ${rowNumber} is missing a customer name.`,
      });
    }

    if (!invoiceNumber) {
      issues.push({
        id: `row-${rowNumber}-invoice`,
        severity: "error",
        rowNumber,
        field: "invoiceNumber",
        message: `Row ${rowNumber} is missing an invoice number.`,
      });
    } else if (invoiceNumbers.has(invoiceNumber)) {
      issues.push({
        id: `row-${rowNumber}-duplicate`,
        severity: "warning",
        rowNumber,
        field: "invoiceNumber",
        message: `Invoice ${invoiceNumber} also appears on row ${invoiceNumbers.get(invoiceNumber)}.`,
      });
    } else {
      invoiceNumbers.set(invoiceNumber, rowNumber);
    }

    if (!dueDateRaw) {
      issues.push({
        id: `row-${rowNumber}-missing-date`,
        severity: "error",
        rowNumber,
        field: "dueDate",
        message: `Row ${rowNumber} is missing a due date.`,
      });
    }

    const dueDate = parseDate(dueDateRaw);
    if (dueDateRaw && !dueDate) {
      issues.push({
        id: `row-${rowNumber}-bad-date`,
        severity: "error",
        rowNumber,
        field: "dueDate",
        message: `Row ${rowNumber} has an invalid due date.`,
      });
    }

    const amountOutstanding = parseMoney(outstandingRaw);
    if (amountOutstanding === null) {
      issues.push({
        id: `row-${rowNumber}-bad-amount`,
        severity: "error",
        rowNumber,
        field: "amountOutstanding",
        message: `Row ${rowNumber} has an invalid outstanding amount.`,
      });
    } else if (amountOutstanding < 0) {
      issues.push({
        id: `row-${rowNumber}-negative-amount`,
        severity: "error",
        rowNumber,
        field: "amountOutstanding",
        message: `Row ${rowNumber} has a negative outstanding amount.`,
      });
    } else if (amountOutstanding === 0) {
      issues.push({
        id: `row-${rowNumber}-zero-amount`,
        severity: "warning",
        rowNumber,
        field: "amountOutstanding",
        message: `Row ${rowNumber} has zero outstanding. It will be imported as paid.`,
      });
    }

    if (!customerEmail) {
      issues.push({
        id: `row-${rowNumber}-email`,
        severity: "warning",
        rowNumber,
        field: "customerEmail",
        message: `Row ${rowNumber} has no customer email. Zentra may recommend finding an AP contact.`,
      });
    }

    if (customerName && invoiceNumber && dueDate && amountOutstanding !== null) {
      const originalAmount = parseMoney(originalAmountRaw) ?? amountOutstanding;
      const daysOverdue = calculateDaysOverdue(dueDate);
      preview.push({
        rowNumber,
        customerName,
        customerEmail: customerEmail || undefined,
        invoiceNumber,
        dueDate,
        invoiceDate: parseDate(invoiceDateRaw) ?? undefined,
        amountOutstanding,
        originalAmount,
        status: deriveStatus(statusRaw, amountOutstanding, daysOverdue),
        paymentReference: paymentReference || undefined,
        notes: notes || undefined,
        customerAccountNumber: customerAccountNumber || undefined,
        daysOverdue,
      });
    }
  });

  return { issues, preview };
}

export function buildInvoicesFromPreview(
  preview: ImportPreviewInvoice[],
  businessId = "biz-imported-demo",
) {
  const customerIds = new Map<string, string>();

  const invoices: Invoice[] = preview.map((item, index) => {
    const customerKey = slug(item.customerAccountNumber || item.customerName);
    const customerId =
      customerIds.get(customerKey) ?? `import-customer-${customerKey}`;
    customerIds.set(customerKey, customerId);

    return {
      id: `import-invoice-${slug(item.invoiceNumber)}-${index + 1}`,
      businessId,
      customerId,
      customerName: item.customerName,
      customerEmail: item.customerEmail,
      customerContactRole: undefined,
      invoiceNumber: item.invoiceNumber,
      invoiceDate: item.invoiceDate ?? item.dueDate,
      dueDate: item.dueDate,
      amount: item.originalAmount,
      amountOutstanding: item.amountOutstanding,
      currency: "GBP",
      status: item.status,
      daysOverdue: item.daysOverdue,
      previousChaseCount: 0,
      paymentClaimed: /paid|payment made|remittance/i.test(item.notes ?? ""),
      remittanceNeeded: /remittance/i.test(item.notes ?? ""),
      statementNeeded: /statement/i.test(item.notes ?? ""),
      relationshipType: "regular customer",
      customerNotes: item.notes,
      lineItems: [
        {
          id: `import-invoice-${slug(item.invoiceNumber)}-${index + 1}-line-1`,
          description: "Imported invoice balance",
          quantity: 1,
          unitPrice: item.originalAmount,
          amount: item.originalAmount,
        },
      ],
      activityHistory: [
        {
          id: `import-invoice-${slug(item.invoiceNumber)}-${index + 1}-activity`,
          invoiceId: `import-invoice-${slug(item.invoiceNumber)}-${index + 1}`,
          customerId,
          businessId,
          type: "imported",
          title: "Imported from CSV",
          description: "Invoice row imported through Zentra Collect import flow.",
          createdAt: new Date().toISOString(),
          createdBy: "Demo user",
        },
      ],
      sourceBatchId: `import-${Date.now()}`,
      importedRowNumber: item.rowNumber,
    };
  });

  const customers: Customer[] = Array.from(customerIds.entries()).map(
    ([key, id]) => {
      const firstInvoice = preview.find(
        (item) => slug(item.customerAccountNumber || item.customerName) === key,
      );

      return {
        id,
        businessId,
        name: firstInvoice?.customerName ?? "Imported customer",
        email: firstInvoice?.customerEmail,
        relationshipType: "regular customer",
        customerNotes: firstInvoice?.notes,
        createdAt: new Date().toISOString(),
      };
    },
  );

  return { invoices, customers };
}

export function compareImportBatches(
  previousInvoices: Invoice[],
  currentInvoices: Invoice[],
  referenceDate = new Date().toISOString().slice(0, 10),
): ImportDiffOutput {
  const previousByInvoiceNumber = indexByInvoiceNumber(previousInvoices);
  const currentByInvoiceNumber = indexByInvoiceNumber(currentInvoices);
  const duplicateInvoices = findDuplicateInvoices(currentInvoices);
  const diff: Omit<
    ImportDiffOutput,
    | "totalPaidAmount"
    | "totalNewlyOverdueAmount"
    | "totalStillOutstanding"
    | "topChanges"
    | "comparedAt"
    | "previousInvoiceCount"
    | "currentInvoiceCount"
  > = {
    paidSinceLastImport: [],
    newlyOverdue: [],
    stillOverdue: [],
    amountChanged: [],
    dueDateChanged: [],
    customerChanged: [],
    newlyAdded: [],
    removed: [],
    promisesMissed: [],
    disputesStillOpen: [],
    duplicateInvoices,
  };

  for (const previous of previousInvoices) {
    const current = currentByInvoiceNumber.get(normalizeKey(previous.invoiceNumber));

    if (!current) {
      diff.paidSinceLastImport.push(
        makeChange("paidSinceLastImport", previous, {
          amount: previous.amountOutstanding,
          message: `${previous.invoiceNumber} no longer appears in the unpaid export, so it is likely paid or removed.`,
          severity: "important",
        }),
      );
      diff.removed.push(
        makeChange("removed", previous, {
          amount: previous.amountOutstanding,
          message: `${previous.invoiceNumber} disappeared from the latest unpaid export.`,
          severity: "info",
        }),
      );
      continue;
    }

    if (previous.amountOutstanding > 0 && current.amountOutstanding <= 0) {
      diff.paidSinceLastImport.push(
        makeChange("paidSinceLastImport", current, {
          amount: previous.amountOutstanding,
          previousAmount: previous.amountOutstanding,
          currentAmount: current.amountOutstanding,
          message: `${current.invoiceNumber} is now showing as paid.`,
          severity: "important",
        }),
      );
    }

    if (previous.amountOutstanding !== current.amountOutstanding) {
      diff.amountChanged.push(
        makeChange("amountChanged", current, {
          previousAmount: previous.amountOutstanding,
          currentAmount: current.amountOutstanding,
          message: `${current.invoiceNumber} changed from ${formatPlainCurrency(previous.amountOutstanding)} to ${formatPlainCurrency(current.amountOutstanding)} outstanding.`,
          severity: "attention",
        }),
      );
    }

    if ((previous.dueDate ?? "") !== (current.dueDate ?? "")) {
      diff.dueDateChanged.push(
        makeChange("dueDateChanged", current, {
          previousValue: previous.dueDate,
          currentValue: current.dueDate,
          message: `${current.invoiceNumber} due date changed from ${previous.dueDate ?? "missing"} to ${current.dueDate ?? "missing"}.`,
          severity: "attention",
        }),
      );
    }

    if (normalizeKey(previous.customerName) !== normalizeKey(current.customerName)) {
      diff.customerChanged.push(
        makeChange("customerChanged", current, {
          previousValue: previous.customerName,
          currentValue: current.customerName,
          message: `${current.invoiceNumber} customer changed from ${previous.customerName} to ${current.customerName}.`,
          severity: "attention",
        }),
      );
    }

    if (previous.daysOverdue <= 0 && current.daysOverdue > 0 && current.amountOutstanding > 0) {
      diff.newlyOverdue.push(
        makeChange("newlyOverdue", current, {
          amount: current.amountOutstanding,
          message: `${current.invoiceNumber} is newly overdue at ${current.daysOverdue} days overdue.`,
          severity: "important",
        }),
      );
    }

    if (previous.daysOverdue > 0 && current.daysOverdue > 0 && current.amountOutstanding > 0) {
      diff.stillOverdue.push(
        makeChange("stillOverdue", current, {
          amount: current.amountOutstanding,
          message: `${current.invoiceNumber} is still overdue with ${formatPlainCurrency(current.amountOutstanding)} outstanding.`,
          severity: current.daysOverdue >= 30 ? "important" : "attention",
        }),
      );
    }

    const promisedDate = current.promisedPaymentDate ?? previous.promisedPaymentDate;
    if (
      promisedDate &&
      promisedDate < referenceDate &&
      current.amountOutstanding > 0 &&
      ["promised", "missed_promise", "overdue"].includes(current.status)
    ) {
      diff.promisesMissed.push(
        makeChange("promisesMissed", current, {
          amount: current.amountOutstanding,
          message: `${current.invoiceNumber} still has a balance after the promised date ${promisedDate}.`,
          severity: "important",
        }),
      );
    }

    if (
      previous.status === "disputed" &&
      current.status === "disputed" &&
      current.amountOutstanding > 0
    ) {
      diff.disputesStillOpen.push(
        makeChange("disputesStillOpen", current, {
          amount: current.amountOutstanding,
          message: `${current.invoiceNumber} is still disputed and unresolved.`,
          severity: "important",
        }),
      );
    }
  }

  for (const current of currentInvoices) {
    if (!previousByInvoiceNumber.has(normalizeKey(current.invoiceNumber))) {
      diff.newlyAdded.push(
        makeChange("newlyAdded", current, {
          amount: current.amountOutstanding,
          message: `${current.invoiceNumber} is new in this import.`,
          severity: current.daysOverdue > 0 ? "attention" : "info",
        }),
      );

      if (current.daysOverdue > 0 && current.amountOutstanding > 0) {
        diff.newlyOverdue.push(
          makeChange("newlyOverdue", current, {
            amount: current.amountOutstanding,
            message: `${current.invoiceNumber} is a newly imported overdue invoice.`,
            severity: "important",
          }),
        );
      }
    }
  }

  const totalPaidAmount = diff.paidSinceLastImport.reduce(
    (total, change) => total + (change.amount ?? change.previousAmount ?? 0),
    0,
  );
  const totalNewlyOverdueAmount = diff.newlyOverdue.reduce(
    (total, change) => total + (change.amount ?? change.currentAmount ?? 0),
    0,
  );
  const totalStillOutstanding = currentInvoices.reduce(
    (total, invoice) => total + invoice.amountOutstanding,
    0,
  );
  const allChanges = Object.values(diff).flat();

  return {
    ...diff,
    totalPaidAmount,
    totalNewlyOverdueAmount,
    totalStillOutstanding,
    topChanges: allChanges
      .sort((a, b) => changePriority(b) - changePriority(a))
      .slice(0, 5),
    comparedAt: new Date().toISOString(),
    previousInvoiceCount: previousInvoices.length,
    currentInvoiceCount: currentInvoices.length,
  };
}

export function createImportSummary(
  fileName: string,
  invoices: Invoice[],
  actionsRecommended: number,
  exceptions: number,
  diff?: ImportDiffOutput,
): ImportSummary {
  return {
    importedAt: new Date().toISOString(),
    fileName,
    cashNeedingAttention: invoices.reduce(
      (total, invoice) => total + invoice.amountOutstanding,
      0,
    ),
    actionsRecommended,
    exceptions,
    invoiceCount: invoices.length,
    diff,
  };
}

export function getRequiredImportFields() {
  return requiredFields;
}

export function parseMoney(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith("-");
  const numeric = Number(trimmed.replace(/[(),£$€\s]/g, ""));
  if (Number.isNaN(numeric)) return null;
  return negative ? -Math.abs(numeric) : numeric;
}

export function parseDate(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = new Date(`${trimmed.slice(0, 10)}T00:00:00.000Z`);
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) && !Number.isNaN(iso.getTime())) {
    return iso.toISOString().slice(0, 10);
  }

  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slash) {
    const [, day, month, year] = slash;
    const fullYear = year.length === 2 ? `20${year}` : year;
    const parsed = new Date(
      `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T00:00:00.000Z`,
    );
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toISOString().slice(0, 10);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function findBestHeader(
  field: ImportTargetField,
  headers: string[],
  used: Set<string>,
): SuggestedMapping {
  const candidates = headers.filter((header) => !used.has(header));
  const normalizedSynonyms = synonyms[field].map(normalize);

  for (const header of candidates) {
    if (normalizedSynonyms.includes(normalize(header))) {
      return {
        field,
        sourceColumn: header,
        confidence: "high",
        reason: "Exact synonym match",
      };
    }
  }

  for (const header of candidates) {
    const normalizedHeader = normalize(header);
    if (
      normalizedSynonyms.some(
        (synonym) =>
          normalizedHeader.includes(synonym) || synonym.includes(normalizedHeader),
      )
    ) {
      return {
        field,
        sourceColumn: header,
        confidence: "medium",
        reason: "Close header match",
      };
    }
  }

  return {
    field,
    sourceColumn: "",
    confidence: "none",
    reason: "No deterministic match. AI-assisted mapping can be added later.",
  };
}

function valueFor(row: string[], headers: string[], sourceColumn?: string) {
  if (!sourceColumn) return "";
  const index = headers.indexOf(sourceColumn);
  return index >= 0 ? row[index]?.trim() ?? "" : "";
}

function deriveStatus(
  rawStatus: string,
  amountOutstanding: number,
  daysOverdue: number,
): CollectionStatus {
  const normalized = normalize(rawStatus);
  if (amountOutstanding <= 0 || normalized.includes("paid")) return "paid";
  if (normalized.includes("dispute") || normalized.includes("query")) {
    return "disputed";
  }
  if (normalized.includes("promise")) return "promised";
  if (normalized.includes("remittance")) return "awaiting_remittance";
  if (normalized.includes("statement")) return "awaiting_statement";
  if (daysOverdue <= 0) return "due_soon";
  return "overdue";
}

function looksLikeApReport(headers: string[]) {
  const combined = headers.map(normalize).join(" ");
  const supplierSignals = ["supplier", "vendor", "bill", "bills payable", "ap"];
  const customerSignals = ["customer", "client", "contact", "invoice"];

  return (
    supplierSignals.some((signal) => combined.includes(signal)) &&
    !customerSignals.some((signal) => combined.includes(signal))
  );
}

function looksLikeCustomerList(
  headers: string[],
  mappings: Partial<Record<ImportTargetField, string>>,
) {
  const combined = headers.map(normalize).join(" ");
  const hasCustomerSignals = /customer|client|contact|email|phone/.test(combined);
  return (
    hasCustomerSignals &&
    !mappings.invoiceNumber &&
    !mappings.dueDate &&
    !mappings.amountOutstanding
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[#._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "unknown"
  );
}

function indexByInvoiceNumber(invoices: Invoice[]) {
  const indexed = new Map<string, Invoice>();
  for (const invoice of invoices) {
    if (!indexed.has(normalizeKey(invoice.invoiceNumber))) {
      indexed.set(normalizeKey(invoice.invoiceNumber), invoice);
    }
  }
  return indexed;
}

function findDuplicateInvoices(invoices: Invoice[]) {
  const counts = new Map<string, Invoice[]>();
  for (const invoice of invoices) {
    const key = normalizeKey(invoice.invoiceNumber);
    counts.set(key, [...(counts.get(key) ?? []), invoice]);
  }

  return Array.from(counts.values())
    .filter((items) => items.length > 1)
    .flatMap((items) =>
      items.map((invoice) =>
        makeChange("duplicateInvoices", invoice, {
          amount: invoice.amountOutstanding,
          message: `${invoice.invoiceNumber} appears ${items.length} times in the latest import.`,
          severity: "attention",
        }),
      ),
    );
}

function makeChange(
  type: ImportChangeType,
  invoice: Invoice,
  options: {
    amount?: number;
    previousAmount?: number;
    currentAmount?: number;
    previousValue?: string | number;
    currentValue?: string | number;
    message: string;
    severity: ImportChange["severity"];
  },
): ImportChange {
  return {
    id: `${type}-${slug(invoice.invoiceNumber)}-${slug(invoice.customerName)}`,
    type,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    ...options,
  };
}

function changePriority(change: ImportChange) {
  const severityWeight = {
    important: 30,
    attention: 20,
    info: 10,
  } satisfies Record<ImportChange["severity"], number>;
  const typeWeight: Partial<Record<ImportChangeType, number>> = {
    paidSinceLastImport: 20,
    promisesMissed: 18,
    disputesStillOpen: 16,
    newlyOverdue: 14,
    amountChanged: 10,
  };

  return (
    severityWeight[change.severity] +
    (typeWeight[change.type] ?? 0) +
    Math.min(20, (change.amount ?? change.currentAmount ?? change.previousAmount ?? 0) / 500)
  );
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatPlainCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}
