"use client";

import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { InvoiceDetailContent } from "@/components/invoice-detail-content";
import type { Invoice } from "@/types/cashpilot";

export function InvoiceDetailDrawer({
  invoice,
  invoices,
  open,
  onOpenChange,
  onUpdateInvoice,
}: {
  invoice: Invoice | null;
  invoices: Invoice[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateInvoice: (invoice: Invoice) => void;
}) {
  if (!invoice) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-3xl border-l-0">
        <InvoiceDetailContent 
          invoice={invoice} 
          invoices={invoices} 
          onUpdateInvoice={onUpdateInvoice} 
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
