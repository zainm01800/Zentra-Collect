import type {
  ActivityEvent,
  BookkeeperClient,
  Business,
  CollectionStatus,
  Customer,
  CustomerBehaviourProfile,
  Dispute,
  ImportBatch,
  ImportDiff,
  ImportMapping,
  Invoice,
  InvoiceLineItem,
  PromiseToPay,
  SafetyCheckResult,
  WeeklyDigest,
} from "@/types/zentra";
import { buildCustomerBehaviourProfile } from "@/lib/collections/customer-behaviour";

const currentBatchId = "batch-2026-05-07-demo";
const previousBatchId = "batch-2026-04-30-demo";
const demoUser = "Alex Chen";

export const demoSingleBusiness: Business = {
  id: "biz-acme-studio",
  name: "Acme Studio Ltd",
  tradingName: "Acme Studio",
  businessType: "agency",
  registeredCountry: "UK",
  defaultCurrency: "GBP",
  contactEmail: "hello@acmestudio.co.uk",
  senderName: "Alex Chen",
  replyToEmail: "accounts@acmestudio.co.uk",
  paymentTermsDays: 14,
  brandVoiceNotes:
    "Warm, clear, professional, and calm. Ask for payment dates without sounding accusatory.",
  createdAt: "2026-01-08",
};

export const demoBookkeeperBusiness: Business = {
  id: "biz-hartley-books",
  name: "Hartley & Co Bookkeeping Ltd",
  tradingName: "Hartley & Co",
  businessType: "bookkeeping_practice",
  registeredCountry: "UK",
  defaultCurrency: "GBP",
  contactEmail: "clients@hartleybooks.co.uk",
  senderName: "Maya Hartley",
  replyToEmail: "collections@hartleybooks.co.uk",
  paymentTermsDays: 14,
  brandVoiceNotes:
    "Bookkeeper tone: practical, polite, and factual. Never imply legal escalation.",
  createdAt: "2025-11-12",
};

const clientBusinesses: Business[] = [
  {
    id: "biz-bloom-bridge",
    name: "Bloom & Bridge Studio Ltd",
    businessType: "agency",
    registeredCountry: "UK",
    defaultCurrency: "GBP",
    contactEmail: "ops@bloombridge.co.uk",
    senderName: "Maya at Hartley & Co",
    replyToEmail: "collections@hartleybooks.co.uk",
    paymentTermsDays: 14,
    brandVoiceNotes: "Friendly agency tone, concise and helpful.",
    createdAt: "2025-12-01",
  },
  {
    id: "biz-calder-it",
    name: "Calder IT Support Ltd",
    businessType: "service_business",
    registeredCountry: "UK",
    defaultCurrency: "GBP",
    contactEmail: "finance@calderit.co.uk",
    senderName: "Maya at Hartley & Co",
    replyToEmail: "collections@hartleybooks.co.uk",
    paymentTermsDays: 30,
    brandVoiceNotes: "Direct, service-led, and factual.",
    createdAt: "2025-12-01",
  },
  {
    id: "biz-finch-field",
    name: "Finch & Field Consulting Ltd",
    businessType: "consultancy",
    registeredCountry: "UK",
    defaultCurrency: "GBP",
    contactEmail: "admin@finchfield.co.uk",
    senderName: "Maya at Hartley & Co",
    replyToEmail: "collections@hartleybooks.co.uk",
    paymentTermsDays: 14,
    brandVoiceNotes: "Professional consultancy tone; ask for dates clearly.",
    createdAt: "2025-12-01",
  },
  {
    id: "biz-rowan-creative",
    name: "Rowan Creative Ltd",
    businessType: "agency",
    registeredCountry: "UK",
    defaultCurrency: "GBP",
    contactEmail: "studio@rowancreative.co.uk",
    senderName: "Maya at Hartley & Co",
    replyToEmail: "collections@hartleybooks.co.uk",
    paymentTermsDays: 14,
    brandVoiceNotes: "Friendly but firm after the second chase.",
    createdAt: "2025-12-01",
  },
  {
    id: "biz-merebrook",
    name: "Merebrook Advisory Ltd",
    businessType: "consultancy",
    registeredCountry: "UK",
    defaultCurrency: "GBP",
    contactEmail: "accounts@merebrookadvisory.co.uk",
    senderName: "Maya at Hartley & Co",
    replyToEmail: "collections@hartleybooks.co.uk",
    paymentTermsDays: 21,
    brandVoiceNotes: "Conservative and precise. Avoid pressure language.",
    createdAt: "2025-12-01",
  },
];

export const demoBookkeeperClients: BookkeeperClient[] = clientBusinesses.map(
  (business, index) => ({
    id: `client-${index + 1}`,
    bookkeeperBusinessId: demoBookkeeperBusiness.id,
    business,
    portfolioLabel: ["Agency", "IT services", "Consulting", "Creative", "Advisory"][
      index
    ],
    primaryContactName:
      ["Sarah Patel", "Jon Bell", "Priya Shah", "Tom Wren", "Elaine Morris"][
        index
      ],
    primaryContactEmail: business.contactEmail,
    importAlias: business.name.replace(" Ltd", ""),
    lastImportBatchId: currentBatchId,
    notes: "Demo portfolio client for collections planning.",
  }),
);

const customers: Customer[] = [
  customer("cust-brightpath", "biz-acme-studio", "BrightPath Media Ltd", "accounts@brightpathmedia.co.uk", "Sarah Lee", "Finance Manager", "regular customer", "Usually pays after one polite reminder."),
  customer("cust-northline", "biz-acme-studio", "Northline Creative", "finance@northlinecreative.co.uk", "Nina Green", "Accounts Payable", "slow payer", "Often requests invoice copies and PO references."),
  customer("cust-atlas", "biz-acme-studio", "Atlas IT Support", "payments@atlasitsupport.co.uk", "Mark Collins", "Operations Director", "new customer", "First quarter working together."),
  customer("cust-greenstone", "biz-acme-studio", "Greenstone Consulting", "ap@greenstoneconsulting.co.uk", "Claire Wade", "AP Lead", "problematic payer", "Several late payments and one unresolved query."),
  customer("cust-riverbank", "biz-acme-studio", "Riverbank Studios", "hello@riverbankstudios.co.uk", "Sam Taylor", "Studio Manager", "regular customer", "Friendly relationship; prefers email reminders."),
  customer("cust-clearview", "biz-bloom-bridge", "Clearview Recruitment", "finance@clearviewrecruitment.co.uk", "Helen Price", "Finance Controller", "regular customer", "Pays reliably once scope queries are resolved."),
  customer("cust-ashford", "biz-bloom-bridge", "Ashford Digital", "accounts@ashforddigital.co.uk", "Amit Rao", "Founder", "high-value customer", "High value but slow to confirm payment dates."),
  customer("cust-bluepeak", "biz-bloom-bridge", "BluePeak Design", "studio@bluepeakdesign.co.uk", "Rachel Owen", "Director", "slow payer", "Needs concise reminders with payment link."),
  customer("cust-harbour", "biz-calder-it", "Harbour Works Ltd", "accounts@harbourworks.co.uk", "Gareth Mills", "Accounts", "regular customer", "Sometimes pays but forgets remittance advice."),
  customer("cust-lancaster", "biz-calder-it", "Lancaster Dental Group", "finance@lancasterdental.co.uk", "Amelia Frost", "Practice Manager", "regular customer", "Prefers monthly statement summaries."),
  customer("cust-maple", "biz-calder-it", "Maple & Stone Property", undefined, undefined, undefined, "new customer", "AP contact missing from export."),
  customer("cust-orchard", "biz-finch-field", "Orchard HR Ltd", "accounts@orchardhr.co.uk", "Beth Naylor", "Finance Assistant", "regular customer", "Generally prompt, currently has a disputed invoice."),
  customer("cust-pioneer", "biz-finch-field", "Pioneer Retail Group", "ap@pioneerretail.co.uk", "Liam Ford", "Accounts Payable", "strategic account", "Large account; use measured language."),
  customer("cust-summit", "biz-rowan-creative", "Summit Ventures", "finance@summitventures.co.uk", "Olivia Reed", "Finance Lead", "problematic payer", "Multiple missed promises."),
  customer("cust-studio-elevate", "biz-rowan-creative", "Studio Elevate", "hello@studioelevate.co.uk", "Martha Jones", "Producer", "regular customer", "Often asks for statement of account."),
  customer("cust-willow", "biz-rowan-creative", "Willow Training Co", "accounts@willowtraining.co.uk", "Peter Hale", "Accounts", "do not chase" as RelationshipType, "Temporarily excluded from chasing by user."),
  customer("cust-kentmere", "biz-merebrook", "Kentmere Kitchens", "payments@kentmerekitchens.co.uk", "Jo Martin", "Finance", "slow payer", "Promise dates need close tracking."),
  customer("cust-elmstead", "biz-merebrook", "Elmstead Legal Services", "billing@elmsteadlegal.co.uk", "Nadia Spencer", "Billing Manager", "regular customer", "Formal tone preferred."),
  customer("cust-redfern", "biz-merebrook", "Redfern Architecture", "accounts@redfernarchitecture.co.uk", "Chris Walton", "Practice Manager", "high-value customer", "High-value advisory work; avoid pressure language."),
];

export const demoCustomers = customers;

export const demoImportMappings: ImportMapping[] = [
  mapping("map-1", "Customer", "customerName", "high"),
  mapping("map-2", "Email", "customerEmail", "high"),
  mapping("map-3", "Invoice No", "invoiceNumber", "high"),
  mapping("map-4", "Invoice Date", "invoiceDate", "high"),
  mapping("map-5", "Due Date", "dueDate", "high"),
  mapping("map-6", "Gross", "amount", "medium"),
  mapping("map-7", "Outstanding", "amountOutstanding", "high"),
  mapping("map-8", "Status / Notes", "notes", "medium"),
  mapping("map-9", "Contact Role", "contactRole", "low"),
];

export const demoImportBatches: ImportBatch[] = [
  {
    id: currentBatchId,
    businessId: demoSingleBusiness.id,
    source: "demo",
    fileName: "overdue-invoices-2026-05-07.csv",
    importedAt: "2026-05-07T09:30:00.000Z",
    importedBy: demoUser,
    rowCount: 42,
    validInvoiceCount: 38,
    warningCount: 6,
    mappings: demoImportMappings,
    notes: "Current demo import with mixed overdue, promise, dispute, and remittance states.",
  },
  {
    id: previousBatchId,
    businessId: demoSingleBusiness.id,
    source: "demo",
    fileName: "overdue-invoices-2026-04-30.csv",
    importedAt: "2026-04-30T09:10:00.000Z",
    importedBy: demoUser,
    rowCount: 39,
    validInvoiceCount: 35,
    warningCount: 5,
    mappings: demoImportMappings,
    notes: "Previous import used for change comparison.",
  },
];

const rows: InvoiceSeed[] = [
  ["acme-1001", "biz-acme-studio", "cust-brightpath", "ACM-1047", "2026-04-01", "2026-04-15", 2450, 2450, "overdue", 22, 1, "2026-05-01"],
  ["acme-1002", "biz-acme-studio", "cust-northline", "ACM-1033", "2026-03-21", "2026-04-04", 1860, 1860, "overdue", 33, 2, "2026-04-30"],
  ["acme-1003", "biz-acme-studio", "cust-atlas", "ACM-1021", "2026-04-10", "2026-04-24", 1430, 1430, "due_soon", 13, 0],
  ["acme-1004", "biz-acme-studio", "cust-greenstone", "ACM-1015", "2026-03-12", "2026-03-26", 2680, 2680, "disputed", 42, 1, "2026-04-24", undefined, "Client says final workshop was not delivered."],
  ["acme-1005", "biz-acme-studio", "cust-riverbank", "ACM-1052", "2026-04-08", "2026-04-22", 1200, 1200, "promised", 15, 1, "2026-05-02", "2026-05-09"],
  ["acme-1006", "biz-acme-studio", "cust-brightpath", "ACM-1058", "2026-04-28", "2026-05-12", 980, 980, "due_soon", 0, 0],
  ["acme-1007", "biz-acme-studio", "cust-northline", "ACM-1009", "2026-02-20", "2026-03-05", 6400, 6400, "missed_promise", 63, 3, "2026-04-29", "2026-05-03"],
  ["acme-1008", "biz-acme-studio", "cust-atlas", "ACM-1060", "2026-04-18", "2026-05-02", 850, 0, "paid", 5, 1, "2026-05-04"],
  ["bb-2001", "biz-bloom-bridge", "cust-clearview", "BB-2201", "2026-03-27", "2026-04-10", 3200, 3200, "awaiting_statement", 27, 1, "2026-04-28"],
  ["bb-2002", "biz-bloom-bridge", "cust-ashford", "BB-2194", "2026-02-28", "2026-03-14", 12750, 12750, "overdue", 54, 2, "2026-05-01"],
  ["bb-2003", "biz-bloom-bridge", "cust-bluepeak", "BB-2210", "2026-04-20", "2026-05-04", 960, 960, "overdue", 3, 0],
  ["bb-2004", "biz-bloom-bridge", "cust-clearview", "BB-2188", "2026-03-04", "2026-03-18", 2180, 2180, "disputed", 50, 2, "2026-04-25", undefined, "Customer queried landing page copy scope."],
  ["bb-2005", "biz-bloom-bridge", "cust-ashford", "BB-2217", "2026-04-14", "2026-04-28", 4500, 4500, "promised", 9, 1, "2026-05-03", "2026-05-10"],
  ["bb-2006", "biz-bloom-bridge", "cust-bluepeak", "BB-2154", "2026-01-29", "2026-02-12", 8900, 8900, "missed_promise", 84, 4, "2026-05-01", "2026-05-06"],
  ["bb-2007", "biz-bloom-bridge", "cust-clearview", "BB-2224", "2026-04-30", "2026-05-14", 780, 780, "due_soon", 0, 0],
  ["cal-3001", "biz-calder-it", "cust-harbour", "CIT-3301", "2026-03-30", "2026-04-29", 2140, 2140, "awaiting_remittance", 8, 1, "2026-05-05"],
  ["cal-3002", "biz-calder-it", "cust-lancaster", "CIT-3298", "2026-03-01", "2026-03-31", 3650, 3650, "awaiting_statement", 37, 2, "2026-04-30"],
  ["cal-3003", "biz-calder-it", "cust-maple", "CIT-3315", "2026-04-15", "2026-05-15", 1120, 1120, "needs_ap_contact", 0, 0],
  ["cal-3004", "biz-calder-it", "cust-harbour", "CIT-3281", "2026-02-14", "2026-03-16", 5200, 0, "paid", 52, 2, "2026-04-28"],
  ["cal-3005", "biz-calder-it", "cust-lancaster", "CIT-3321", "2026-04-21", "2026-05-21", 900, 900, "due_soon", 0, 0],
  ["cal-3006", "biz-calder-it", "cust-maple", "CIT-3260", "2026-01-18", "2026-02-17", 2840, 2840, "needs_ap_contact", 79, 0],
  ["ff-4001", "biz-finch-field", "cust-orchard", "FFC-4107", "2026-04-03", "2026-04-17", 1750, 1750, "disputed", 20, 1, "2026-04-29", undefined, "Customer disputes additional research day."],
  ["ff-4002", "biz-finch-field", "cust-pioneer", "FFC-4095", "2026-03-10", "2026-03-24", 9800, 9800, "overdue", 44, 2, "2026-04-26"],
  ["ff-4003", "biz-finch-field", "cust-orchard", "FFC-4120", "2026-04-25", "2026-05-09", 640, 640, "due_soon", 0, 0],
  ["ff-4004", "biz-finch-field", "cust-pioneer", "FFC-4082", "2026-02-20", "2026-03-06", 4250, 4250, "promised", 62, 3, "2026-05-02", "2026-05-08"],
  ["ff-4005", "biz-finch-field", "cust-orchard", "FFC-4071", "2026-01-15", "2026-01-29", 2200, 0, "paid", 91, 2, "2026-04-12"],
  ["row-5001", "biz-rowan-creative", "cust-summit", "RC-5102", "2026-03-03", "2026-03-17", 3600, 3600, "missed_promise", 51, 4, "2026-05-01", "2026-05-05"],
  ["row-5002", "biz-rowan-creative", "cust-studio-elevate", "RC-5121", "2026-04-12", "2026-04-26", 1350, 1350, "awaiting_statement", 11, 1, "2026-05-03"],
  ["row-5003", "biz-rowan-creative", "cust-willow", "RC-5088", "2026-02-01", "2026-02-15", 1800, 1800, "do_not_chase", 81, 0],
  ["row-5004", "biz-rowan-creative", "cust-summit", "RC-5113", "2026-03-28", "2026-04-11", 1150, 1150, "awaiting_remittance", 26, 1, "2026-05-04"],
  ["row-5005", "biz-rowan-creative", "cust-studio-elevate", "RC-5133", "2026-04-29", "2026-05-13", 2100, 2100, "due_soon", 0, 0],
  ["mer-6001", "biz-merebrook", "cust-kentmere", "MBA-6101", "2026-03-22", "2026-04-12", 1850, 1850, "promised", 25, 1, "2026-05-02", "2026-05-09"],
  ["mer-6002", "biz-merebrook", "cust-elmstead", "MBA-6092", "2026-03-01", "2026-03-22", 2750, 2750, "overdue", 46, 2, "2026-04-27"],
  ["mer-6003", "biz-merebrook", "cust-redfern", "MBA-6077", "2026-02-14", "2026-03-07", 11200, 11200, "overdue", 61, 2, "2026-05-01"],
  ["mer-6004", "biz-merebrook", "cust-kentmere", "MBA-6112", "2026-04-20", "2026-05-11", 740, 740, "due_soon", 0, 0],
  ["mer-6005", "biz-merebrook", "cust-elmstead", "MBA-6061", "2026-01-20", "2026-02-10", 4200, 0, "paid", 86, 3, "2026-04-18"],
  ["mer-6006", "biz-merebrook", "cust-redfern", "MBA-6119", "2026-04-10", "2026-05-01", 3200, 3200, "awaiting_remittance", 6, 1, "2026-05-06"],
  ["acme-1009", "biz-acme-studio", "cust-greenstone", "ACM-0990", "2026-01-12", "2026-01-26", 3100, 3100, "do_not_chase", 101, 2, "2026-03-01"],
  ["bb-2008", "biz-bloom-bridge", "cust-bluepeak", "BB-2227", "2026-05-01", "2026-05-15", 640, 640, "due_soon", 0, 0],
];

export const demoInvoices: Invoice[] = rows.map((row, index) =>
  makeInvoice(row, index + 1),
);

export const demoImportDiffs: ImportDiff[] = [
  diff("diff-1", "bb-2006", "promise_missed", "BluePeak missed a promised payment", "Promised for 06 May; still outstanding in latest import.", "promised", "missed_promise", "important"),
  diff("diff-2", "cal-3001", "status_changed", "Harbour Works now needs remittance", "Customer says payment was made but no remittance advice is available.", "overdue", "awaiting_remittance", "attention"),
  diff("diff-3", "ff-4001", "new_dispute", "Orchard HR raised a dispute", "Latest notes mention a query about an additional research day.", null, "disputed", "important"),
  diff("diff-4", "cal-3004", "paid_since_last_import", "Harbour Works invoice paid", "Balance moved from £5,200 to £0.", 5200, 0, "info"),
  diff("diff-5", "mer-6003", "balance_changed", "Redfern Architecture balance unchanged", "High-value invoice remains outstanding after last chase.", 11200, 11200, "attention"),
  diff("diff-6", "cal-3003", "customer_detail_changed", "Maple & Stone missing AP contact", "Import has no usable email or AP contact role.", "unknown", "missing", "attention"),
];

export const demoCustomerBehaviourProfiles: CustomerBehaviourProfile[] =
  customers.map((customer) => buildCustomerBehaviourProfile(customer, demoInvoices));

export const demoSafetyChecks: SafetyCheckResult[] = demoInvoices.flatMap((invoice) => {
  const checks: SafetyCheckResult[] = [];

  if (!invoice.customerEmail) {
    checks.push(safety(invoice, "blocked", "missing_customer_email", "Missing customer email", "Add an AP contact before drafting a chase message.", false));
  }
  if (invoice.status === "disputed") {
    checks.push(safety(invoice, "blocked", "active_dispute", "Active dispute", "Do not demand payment until the dispute has been addressed.", true));
  }
  if (invoice.status === "do_not_chase") {
    checks.push(safety(invoice, "blocked", "do_not_chase", "Do not chase", "User or client has excluded this invoice from chasing.", false));
  }
  if (invoice.status === "paid") {
    checks.push(safety(invoice, "blocked", "paid_invoice", "Already paid", "No collections message should be drafted for a paid invoice.", false));
  }
  if (invoice.status === "promised") {
    checks.push(safety(invoice, "needs_review", "promise_not_due", "Promise date pending", "Check whether the promised date has passed before chasing again.", true));
  }
  if (invoice.status === "missed_promise") {
    checks.push(safety(invoice, "needs_review", "missed_promise", "Missed promise", "Follow up on the missed payment promise and ask for a revised date.", true));
  }
  if (invoice.status === "awaiting_remittance") {
    checks.push(safety(invoice, "needs_review", "payment_claimed", "Payment claimed", "Ask for remittance advice rather than sending a standard reminder.", true));
  }
  if (invoice.amountOutstanding >= 8000 && invoice.status !== "paid") {
    checks.push(safety(invoice, "needs_review", "high_value", "High-value balance", "Review tone carefully before sending.", true));
  }

  return checks;
});

export const demoWeeklyDigest: WeeklyDigest = {
  id: "digest-2026-w19",
  businessId: demoSingleBusiness.id,
  weekStarting: "2026-05-04",
  generatedAt: "2026-05-07T09:45:00.000Z",
  totalOutstanding: sum(demoInvoices.map((invoice) => invoice.amountOutstanding)),
  totalCashToChase: sum(
    demoInvoices
      .filter((invoice) =>
        ["overdue", "missed_promise", "awaiting_remittance", "awaiting_statement"].includes(
          invoice.status,
        ),
      )
      .map((invoice) => invoice.amountOutstanding),
  ),
  invoicesToChase: demoInvoices.filter((invoice) =>
    ["overdue", "missed_promise"].includes(invoice.status),
  ).length,
  promisesDue: demoInvoices.filter((invoice) => invoice.status === "promised").length,
  missedPromises: demoInvoices.filter((invoice) => invoice.status === "missed_promise").length,
  disputesOpen: demoInvoices.filter((invoice) => invoice.status === "disputed").length,
  remittanceRequests: demoInvoices.filter(
    (invoice) => invoice.status === "awaiting_remittance",
  ).length,
  statementRequests: demoInvoices.filter(
    (invoice) => invoice.status === "awaiting_statement",
  ).length,
  topActions: [
    { action: "send_payment_reminder", count: 8, amount: 40790 },
    { action: "follow_up_promise_to_pay", count: 3, amount: 11650 },
    { action: "request_remittance_advice", count: 3, amount: 6490 },
    { action: "respond_to_dispute", count: 3, amount: 6630 },
    { action: "send_statement_of_account", count: 3, amount: 7150 },
  ],
  safetyWarnings: demoSafetyChecks.filter((check) => check.status !== "safe_to_draft").slice(0, 8),
};

function customer(
  id: string,
  businessId: string,
  name: string,
  email: string | undefined,
  contactName: string | undefined,
  contactRole: string | undefined,
  relationshipType: RelationshipType,
  customerNotes: string,
): Customer {
  return {
    id,
    businessId,
    name,
    email,
    contactName,
    contactRole,
    apEmail: email,
    apContactName: contactName,
    relationshipType,
    customerNotes,
    doNotChase: relationshipType === "do not chase",
    createdAt: "2026-01-15",
  };
}

type RelationshipType = Customer["relationshipType"];

type InvoiceSeed = [
  id: string,
  businessId: string,
  customerId: string,
  invoiceNumber: string,
  invoiceDate: string,
  dueDate: string,
  amount: number,
  amountOutstanding: number,
  status: CollectionStatus,
  daysOverdue: number,
  previousChaseCount: number,
  lastChasedDate?: string,
  promisedPaymentDate?: string,
  disputeReason?: string,
];

function makeInvoice(row: InvoiceSeed, rowNumber: number): Invoice {
  const [
    id,
    businessId,
    customerId,
    invoiceNumber,
    invoiceDate,
    dueDate,
    amount,
    amountOutstanding,
    status,
    daysOverdue,
    previousChaseCount,
    lastChasedDate,
    promisedPaymentDate,
    disputeReason,
  ] = row;
  const customerRecord = customers.find((customerItem) => customerItem.id === customerId);
  if (!customerRecord) throw new Error(`Missing demo customer ${customerId}`);

  const lineItems: InvoiceLineItem[] = [
    {
      id: `${id}-line-1`,
      description: lineItemFor(status),
      quantity: 1,
      unitPrice: amount,
      amount,
    },
  ];

  const promiseToPay: PromiseToPay | undefined = promisedPaymentDate
    ? {
        id: `${id}-promise`,
        invoiceId: id,
        promisedAmount: amountOutstanding,
        promisedDate: promisedPaymentDate,
        recordedAt: lastChasedDate ?? "2026-05-01",
        recordedBy: demoUser,
        status: status === "missed_promise" ? "missed" : "open",
        notes:
          status === "missed_promise"
            ? "Promised date has passed with balance still outstanding."
            : "Customer gave a payment date in response to a reminder.",
      }
    : undefined;

  const dispute: Dispute | undefined = disputeReason
    ? {
        id: `${id}-dispute`,
        invoiceId: id,
        reason: disputeReason,
        raisedAt: lastChasedDate ?? "2026-04-25",
        raisedBy: customerRecord.contactName,
        owner: "Client finance team",
        status: "open",
      }
    : undefined;

  return {
    id,
    businessId,
    bookkeeperClientId: demoBookkeeperClients.find(
      (client) => client.business.id === businessId,
    )?.id,
    customerId,
    customerName: customerRecord.name,
    customerEmail: customerRecord.email,
    customerContactRole: customerRecord.contactRole,
    invoiceNumber,
    invoiceDate,
    dueDate,
    amount,
    amountOutstanding,
    currency: "GBP",
    status,
    daysOverdue,
    previousChaseCount,
    lastChasedDate,
    promisedPaymentDate,
    disputeReason,
    paymentClaimed: status === "awaiting_remittance",
    remittanceNeeded: status === "awaiting_remittance",
    statementNeeded: status === "awaiting_statement",
    relationshipType: customerRecord.relationshipType,
    customerNotes: customerRecord.customerNotes,
    lineItems,
    activityHistory: buildActivity(id, businessId, customerId, status, lastChasedDate),
    promiseToPay,
    dispute,
    sourceBatchId: currentBatchId,
    importedRowNumber: rowNumber,
  };
}

function buildActivity(
  invoiceId: string,
  businessId: string,
  customerId: string,
  status: CollectionStatus,
  lastChasedDate?: string,
): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      id: `${invoiceId}-activity-imported`,
      invoiceId,
      customerId,
      businessId,
      type: "imported",
      title: "Imported from overdue invoice export",
      description: "Invoice row imported into Zentra Flow demo mode.",
      createdAt: "2026-05-07T09:30:00.000Z",
      createdBy: demoUser,
    },
  ];

  if (lastChasedDate) {
    events.push({
      id: `${invoiceId}-activity-chased`,
      invoiceId,
      customerId,
      businessId,
      type: "chase_marked_sent",
      title: "Previous chase recorded",
      description: "Previous reminder activity was present in the import notes.",
      createdAt: `${lastChasedDate}T10:00:00.000Z`,
      createdBy: demoUser,
    });
  }

  if (status === "disputed") {
    events.push({
      id: `${invoiceId}-activity-dispute`,
      invoiceId,
      customerId,
      businessId,
      type: "dispute_recorded",
      title: "Dispute recorded",
      description: "Invoice should not receive a standard payment reminder.",
      createdAt: "2026-05-07T09:35:00.000Z",
      createdBy: demoUser,
    });
  }

  return events;
}

function lineItemFor(status: CollectionStatus) {
  if (status === "awaiting_statement") return "Monthly statement balance";
  if (status === "awaiting_remittance") return "Services paid without remittance";
  if (status === "disputed") return "Project services under query";
  return "Professional services";
}

function mapping(
  id: string,
  sourceColumn: ImportMapping["sourceColumn"],
  targetField: ImportMapping["targetField"],
  confidence: ImportMapping["confidence"],
): ImportMapping {
  return {
    id,
    batchId: currentBatchId,
    sourceColumn,
    targetField,
    confidence,
    reviewedByUser: confidence !== "low",
  };
}

function diff(
  id: string,
  invoiceId: string,
  type: ImportDiff["type"],
  title: string,
  description: string,
  beforeValue: ImportDiff["beforeValue"],
  afterValue: ImportDiff["afterValue"],
  severity: ImportDiff["severity"],
): ImportDiff {
  return {
    id,
    currentBatchId,
    previousBatchId,
    invoiceId,
    type,
    title,
    description,
    beforeValue,
    afterValue,
    severity,
  };
}

function safety(
  invoice: Invoice,
  status: SafetyCheckResult["status"],
  code: SafetyCheckResult["code"],
  title: string,
  explanation: string,
  canDraftMessage: boolean,
): SafetyCheckResult {
  return {
    id: `${invoice.id}-${code}`,
    invoiceId: invoice.id,
    status,
    code,
    title,
    explanation,
    canDraftMessage,
    requiresHumanReview: status !== "safe_to_draft",
  };
}


function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

// ── Adapter: zentra Invoice → cashpilot Invoice ───────────────────────────────
// Lets the ChaseQueue (typed to cashpilot Invoice) consume zentra demo data so
// both the Dashboard and Collections tab show the same underlying invoices.

import type { Invoice as CashpilotInvoice, InvoiceStatus, RelationshipType as CpRelationshipType } from "@/types/cashpilot";

function zentraRelationshipToCashpilot(r: RelationshipType): CpRelationshipType {
  switch (r) {
    case "new customer":      return "new client";
    case "high-value customer":
    case "strategic account": return "high-value client";
    case "slow payer":
    case "problematic payer":
    case "do not chase":      return "problematic payer";
    case "regular customer":
    default:                  return "regular client";
  }
}

function zentraStatusToCashpilot(status: CollectionStatus): InvoiceStatus {
  switch (status) {
    case "paid":                return "Paid";
    case "due_soon":            return "Due soon";
    case "promised":            return "Promised payment";
    case "missed_promise":      return "Needs call";
    case "disputed":            return "Disputed";
    case "awaiting_remittance": return "Reminder sent";
    case "awaiting_statement":  return "Reminder sent";
    case "needs_ap_contact":    return "Overdue";
    case "do_not_chase":        return "Paid"; // exclude from chase queue
    case "overdue":
    default:                    return "Overdue";
  }
}

export const demoCashpilotInvoices: CashpilotInvoice[] = demoInvoices.map((inv) => ({
  id: inv.id,
  customerName: inv.customerName,
  customerEmail: inv.customerEmail ?? "",
  invoiceNumber: inv.invoiceNumber,
  amount: inv.amountOutstanding,
  currency: "GBP",
  issueDate: inv.invoiceDate,
  dueDate: inv.dueDate ?? "",
  daysOverdue: inv.daysOverdue,
  status: zentraStatusToCashpilot(inv.status),
  lastChasedAt: inv.lastChasedDate ?? null,
  followUpDate: null,
  promisedPaymentDate: inv.promisedPaymentDate ?? null,
  chaseCount: inv.previousChaseCount,
  relationshipType: zentraRelationshipToCashpilot(inv.relationshipType),
  notes: inv.customerNotes ?? "",
  paymentLink: "",
  lineItems: inv.lineItems.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
  })),
  activityHistory: inv.activityHistory.map((ev) => ({
    id: ev.id,
    type: "note" as const,
    title: ev.title,
    description: ev.description,
    createdAt: ev.createdAt,
  })),
}));
