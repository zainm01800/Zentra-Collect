"use client";

import { useEffect } from "react";

/**
 * Fires window.print() once on mount so the customer lands directly in
 * the "Save as PDF" dialog. Kept as a tiny client island so the parent
 * page can stay a server component.
 */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}
