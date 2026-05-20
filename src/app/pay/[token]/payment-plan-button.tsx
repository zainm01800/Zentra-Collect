"use client";

/**
 * PaymentPlanButton — client toggle for the payment plan proposal panel.
 * Rendered inside the server-component pay page.
 */

import { useState } from "react";
import { LayoutList } from "lucide-react";
import { PaymentPlanForm } from "@/components/payment-plan-form";

interface Props {
  token: string;
  totalAmount: number;
  businessName: string;
  invoiceNumber: string;
}

export function PaymentPlanButton({ token, totalAmount, businessName, invoiceNumber }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-300 dark:border-neutral-600 dark:text-neutral-300 px-4 py-3 text-[13px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
        >
          <LayoutList className="size-3.5" />
          Request a payment plan
        </button>
      ) : (
        <PaymentPlanForm
          token={token}
          totalAmount={totalAmount}
          businessName={businessName}
          invoiceNumber={invoiceNumber}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
