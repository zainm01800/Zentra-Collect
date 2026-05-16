import { redirect } from "next/navigation";

// Stage 2 — /invoices/new is now opened in-place as a sheet inside the
// /invoices hub. Keep the old route alive as a redirect so bookmarks,
// email links, and the existing nav still work.
export default function NewInvoiceRedirect() {
  redirect("/invoices?create=1");
}
