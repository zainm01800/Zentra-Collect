export type InvoiceStatus =
  | "Not due"
  | "Due soon"
  | "Overdue"
  | "Reminder drafted"
  | "Reminder sent"
  | "Promised payment"
  | "Disputed"
  | "Needs call"
  | "Paid";

export type RelationshipType =
  | "new client"
  | "regular client"
  | "high-value client"
  | "problematic payer";

export type ReminderTone = "Friendly" | "Neutral" | "Firm" | "Final notice";

export type ReminderOptions = {
  mentionPreviousReminder: boolean;
  askForPaymentDate: boolean;
  includePaymentLink: boolean;
  avoidLateFeeWording: boolean;
  keepRelationshipWarm: boolean;
};

export type ActivityType =
  | "invoice_created"
  | "reminder_drafted"
  | "reminder_sent"
  | "promised_payment"
  | "dispute_logged"
  | "call_needed"
  | "paid"
  | "note";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  createdAt: string;
};

export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  customerName: string;
  customerEmail: string;
  invoiceNumber: string;
  amount: number;
  currency: "GBP";
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  status: InvoiceStatus;
  lastChasedAt: string | null;
  followUpDate?: string | null;
  promisedPaymentDate?: string | null;
  chaseCount: number;
  relationshipType: RelationshipType;
  notes: string;
  paymentLink: string;
  lineItems: LineItem[];
  activityHistory: ActivityItem[];
};

export type UrgencyLevel = "Low" | "Medium" | "High" | "Critical" | "Blocked";
