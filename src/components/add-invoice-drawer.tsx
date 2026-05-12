"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { calculateDaysOverdue } from "@/lib/invoice-logic";
import type { Invoice, InvoiceStatus, RelationshipType } from "@/types/cashpilot";

export function AddInvoiceDrawer({
  open,
  onOpenChange,
  onAddInvoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddInvoice: (invoice: Invoice) => void;
}) {
  const [status, setStatus] = useState<InvoiceStatus>("Overdue");
  const [relationshipType, setRelationshipType] =
    useState<RelationshipType>("regular client");

  function submit(formData: FormData) {
    const dueDate = String(formData.get("dueDate"));
    const amount = Number(formData.get("amount"));
    const invoice: Invoice = {
      id: `manual-${Date.now()}`,
      customerName: String(formData.get("customerName")),
      customerEmail: String(formData.get("customerEmail")),
      invoiceNumber: String(formData.get("invoiceNumber")),
      amount,
      currency: "GBP",
      issueDate: String(formData.get("issueDate")),
      dueDate,
      daysOverdue: calculateDaysOverdue(dueDate),
      status,
      lastChasedAt: null,
      followUpDate: String(formData.get("followUpDate")) || null,
      chaseCount: 0,
      relationshipType,
      notes: String(formData.get("notes")),
      paymentLink: String(formData.get("paymentLink")) || "https://pay.example.com/manual",
      lineItems: [
        {
          description: String(formData.get("description")) || "Professional services",
          quantity: 1,
          unitPrice: amount,
        },
      ],
      activityHistory: [
        {
          id: `act-manual-${Date.now()}`,
          type: "invoice_created",
          title: "Manual invoice added",
          description: "Added in demo mode before Xero sync is connected.",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    onAddInvoice(invoice);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <form action={submit} className="space-y-5 p-6">
          <SheetHeader>
            <SheetTitle>Add invoice manually</SheetTitle>
            <SheetDescription>
              Fill in the invoice details below. Import a CSV to add multiple invoices at once.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="customerName" label="Customer name" defaultValue="Harbour Works Ltd" />
            <Field name="customerEmail" label="Customer email" defaultValue="accounts@harbourworks.co.uk" />
            <Field name="invoiceNumber" label="Invoice number" defaultValue="CP-2026-1019" />
            <Field name="amount" label="Amount" type="number" defaultValue="2400" />
            <Field name="issueDate" label="Issue date" type="date" defaultValue="2026-04-10" />
            <Field name="dueDate" label="Due date" type="date" defaultValue="2026-04-24" />
            <Field name="followUpDate" label="Follow-up date" type="date" defaultValue="2026-05-07" />
            <Field name="paymentLink" label="Payment link" defaultValue="https://pay.example.com/inv-1019" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as InvoiceStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Due soon", "Overdue", "Reminder drafted", "Reminder sent", "Promised payment", "Disputed", "Needs call"].map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select
                value={relationshipType}
                onValueChange={(value) => setRelationshipType(value as RelationshipType)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["new client", "regular client", "high-value client", "problematic payer"].map((item) => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Field name="description" label="Line item" defaultValue="Strategy sprint" />
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue="Added manually to test the credit-control workflow."
            />
          </div>

          <Button className="w-full">
            <Plus className="size-4" />
            Add to chase queue
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required />
    </div>
  );
}
