"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InvoiceCard } from "@/components/invoice-card";
import { InvoiceDetailDrawer } from "@/components/invoice-detail-drawer";
import { InvoiceDetailContent } from "@/components/invoice-detail-content";
import { CustomerProfileDrawer } from "@/components/customer-profile-drawer";
import { AddInvoiceDrawer } from "@/components/add-invoice-drawer";
import {
  filterInvoices,
  invoiceNeedsActionToday,
  sortInvoicesByPriority,
  type QueueFilter,
} from "@/lib/invoice-logic";
import type { Invoice } from "@/types/cashpilot";
import {
  SectionCard,
  PillTabs,
  EmptyState,
} from "./zentra-ui";

export function ChaseQueue({
  initialInvoices,
  onlyToday = true,
  topContent,
}: {
  initialInvoices: Invoice[];
  onlyToday?: boolean;
  topContent?: React.ReactNode;
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<QueueFilter>(onlyToday ? "today" : "all");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

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
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
      {/* Main List Area */}
      <div className="flex-1 min-w-0 space-y-8">
        {topContent}
        
        {/* Actions Bar */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
           <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customers..."
              className="h-12 rounded-full border-black/5 bg-white/50 pl-11 shadow-none transition-all focus-visible:ring-black/5 focus-visible:bg-white focus-visible:shadow-xl"
            />
          </div>
          <Button
            type="button"
            onClick={() => setAddDrawerOpen(true)}
            className="h-12 rounded-full bg-neutral-950 px-8 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="mr-2 size-4" />
            Add invoice
          </Button>
        </div>

        <div className="rounded-[2.5rem] border border-black/5 bg-white/40 p-2 shadow-sm backdrop-blur-sm overflow-x-auto">
          <PillTabs
            activeTab={filter}
            onTabChange={(id) => setFilter(id as QueueFilter)}
            tabs={filters.map((f) => ({
              id: f.value,
              label: f.label,
              count: f.count,
            }))}
          />
        </div>

        <div className="space-y-4">
          {!queue.length ? (
            <EmptyState
              title="No results found"
              description="Adjust your search or filters to see more invoices."
              icon={Search}
            />
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
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
        </div>
      </div>

      {/* Desktop Inline Detail Panel */}
      {drawerOpen && selectedInvoice && (
        <div className="hidden lg:block h-[calc(100vh-12rem)] w-[500px] shrink-0 sticky top-28 rounded-[2.5rem] border border-black/5 bg-white shadow-[0_0_50px_rgba(0,0,0,0.1)] overflow-hidden animate-in slide-in-from-right-12 fade-in duration-500">
          <InvoiceDetailContent
            invoice={selectedInvoice}
            invoices={invoices}
            onUpdateInvoice={updateInvoice}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
      )}

      {/* Mobile/Tablet Overlays */}
      {isMobile && selectedInvoice && (
        <InvoiceDetailDrawer
          invoice={selectedInvoice}
          invoices={invoices}
          open={drawerOpen && isMobile}
          onOpenChange={setDrawerOpen}
          onUpdateInvoice={updateInvoice}
        />
      )}

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
