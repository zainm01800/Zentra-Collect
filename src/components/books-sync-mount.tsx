"use client";

/**
 * Invisible client component that triggers the once-per-session
 * localStorage ↔ Supabase sync for the four books data types
 * (mileage, quotes, credit notes, direct income). Mount it anywhere
 * inside the authenticated app shell — usually once at the root.
 *
 * Renders nothing. Uses sessionStorage to ensure the heavy push+hydrate
 * only runs once per tab.
 */

import { useEffect } from "react";
import { syncBooks } from "@/lib/books-sync";

export function BooksSyncMount() {
  useEffect(() => {
    void syncBooks();
  }, []);
  return null;
}
