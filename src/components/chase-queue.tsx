"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { InvoiceCard } from "@/components/invoice-card";
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer";
import { CustomerProfileDrawer } from "@/components/customer-profile-drawer";
import { AddInvoiceDrawer } from "@/components/add-invoice-drawer";
import {
  filterInvoices,
  invoiceNeedsActionToday,
  sortInvoicesByPriority,
  type QueueFilter,
} from "@/lib/invoice-logic";
import type { Invoice } from "@/types/cashpilot";

export function ChaseQueue({
  initialInvoices,
  onlyToday = true,
}: {
  initialInvoices: Invoice[];
  onlyToday?: boolean;
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>(onlyToday ? "today" : "all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);

  const queue = useMemo(() => {
    return sortInvoicesByPriority(
      filterInvoices(invoices, filter).filter((invoice) => {
        const matchesToday =
          onlyToday && filter === "today" ? invoiceNeedsActionToday(invoice) : true;
        const matchesQuery =
          invoice.customerName.toLowerCase().includes(query.toLowerCase()) ||
          invoice.invoiceNumber.toLowerCase().includes(query.toLowerCase());
        return matchesToday && matchesQuery;
      }),
    );
  }, [filter, invoices, onlyToday, query]);

  const filters: { label: string; value: QueueFilter; count: number }[] = [
    { label: "Today", value: "today", count: filterInvoices(invoices, "today").length },
    { label: "All open", value: "all", count: filterInvoices(invoices, "all").length },
    { label: "Calls", value: "calls", count: filterInvoices(invoices, "calls").length },
    {
      label: "Promises",
      value: "promises",
      count: filterInvoices(invoices, "promises").length,
    },
    {
      label: "Disputes",
      value: "disputes",
      count: filterInvoices(invoices, "disputes").length,
    },
    { label: "Final", value: "final", count: filterInvoices(invoices, "final").length },
    { label: "Paid", value: "paid", count: filterInvoices(invoices, "paid").length },
  ];

  function openInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setCustomerDrawerOpen(false);
    setDrawerOpen(true);
  }

  function openCustomer(customerName: string) {
    setSelectedCustomer(customerName);
    setDrawerOpen(false);
    setCustomerDrawerOpen(true);
  }

  function updateInvoice(nextInvoice: Invoice) {
    setInvoices((current) =>
      current.map((invoice) =>
        invoice.id === nextInvoice.id ? nextInvoice : invoice,
      ),
    );
    setSelectedInvoice(nextInvoice);
  }

  function addInvoice(invoice: Invoice) {
    setInvoices((current) => [invoice, ...current]);
    setSelectedInvoice(invoice);
    setFilter("today");
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Chase Today</h2>
          <p className="text-sm text-muted-foreground">
            Start at the top. Each item has a recommended action and the context
            needed to send it safely.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer or invoice"
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAddDrawerOpen(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" />
            Add invoice
          </Button>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardContent className="p-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={filter === item.value ? "default" : "ghost"}
                className="h-8 shrink-0"
                onClick={() => setFilter(item.value)}
              >
                {item.label}
                <span className="ml-1 rounded bg-background/20 px-1.5 font-mono text-xs">
                  {item.count}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!queue.length ? (
        <Alert className="rounded-lg">
          <AlertCircle className="size-4" />
          <AlertTitle>No invoices match this view</AlertTitle>
          <AlertDescription>
            Try another filter or add a demo invoice. Paid and not-due invoices
            stay out of the Today queue so the team can focus.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {queue.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              invoices={invoices}
              onOpenCustomer={openCustomer}
              onOpen={openInvoice}
            />
          ))}
        </div>
      )}

      <InvoiceDetailDrawer
        invoice={selectedInvoice}
        invoices={invoices}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onUpdateInvoice={updateInvoice}
      />
      <CustomerProfileDrawer
        customerName={selectedCustomer}
        invoices={invoices}
        open={customerDrawerOpen}
        onOpenChange={setCustomerDrawerOpen}
        onOpenInvoice={openInvoice}
      />
      <AddInvoiceDrawer
        open={addDrawerOpen}
        onOpenChange={setAddDrawerOpen}
        onAddInvoice={addInvoice}
      />
    </div>
  );
}
