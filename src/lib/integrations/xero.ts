import { demoInvoices } from "@/data/demo-invoices";

export async function connectXero() {
  // TODO: Implement OAuth 2.0 authorization code flow and token storage.
  return {
    mode: "demo",
    connected: false,
    authorizationUrl: null,
  };
}

export async function fetchInvoices() {
  // TODO: Replace with Xero Accounting API invoices endpoint after OAuth is wired.
  return demoInvoices;
}

export async function fetchContacts() {
// TODO: Replace with Xero contacts endpoint and map to Zentra customers.
  return Array.from(
    new Map(
      demoInvoices.map((invoice) => [
        invoice.customerEmail,
        {
          name: invoice.customerName,
          email: invoice.customerEmail,
          relationshipType: invoice.relationshipType,
        },
      ]),
    ).values(),
  );
}

export async function syncInvoices() {
  // TODO: Upsert Xero invoices, contacts, and reminder state into Supabase.
  return {
    mode: "demo",
    syncedAt: new Date().toISOString(),
    invoices: demoInvoices,
  };
}
