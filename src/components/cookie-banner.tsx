"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE_KEY = "zentra.cookieConsent.v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
      style={{ background: "var(--zn-surface-2)", borderColor: "var(--zn-line-soft)" }}
    >
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
        We use essential cookies to keep you signed in and remember your preferences. No tracking or advertising cookies.{" "}
        <Link href="/privacy" className="underline underline-offset-2" style={{ color: "var(--zn-ink)" }}>
          Privacy policy
        </Link>
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={accept}
          className="zn-pill"
          style={{ background: "var(--zn-ink)", color: "var(--zn-surface)", fontSize: 13, height: 34, padding: "0 16px" }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
