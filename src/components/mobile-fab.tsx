"use client";

/**
 * Mobile floating action button — Stage 6 audit.
 *
 * One-tap path to "new invoice" from anywhere in the app on mobile.
 * Sits above the bottom-nav strip (which is ~64px + safe-area) and
 * only renders on mobile (md:hidden). Hidden when the bottom nav is
 * also hidden (e.g. on /pay/* customer-facing routes that have no
 * authenticated shell).
 *
 * Behaviour:
 *   - /today, /invoices, /customers, /chase-today → "+ New invoice"
 *   - Anywhere else → hidden (don't be a constant interruption)
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

const SHOW_ON = ["/today", "/invoices", "/customers", "/chase-today", "/dashboard"];

export function MobileFab() {
  const pathname = usePathname() ?? "";
  const show = SHOW_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!show) return null;

  return (
    <Link
      href="/invoices?create=1"
      aria-label="New invoice"
      className="md:hidden fixed z-30 right-4 rounded-full shadow-lg flex items-center justify-center"
      style={{
        bottom:     "calc(5rem + env(safe-area-inset-bottom))",
        width:      56,
        height:     56,
        background: "var(--zn-ink)",
        color:      "var(--zn-bg)",
      }}
    >
      <Plus className="size-6" strokeWidth={2.5} />
    </Link>
  );
}
