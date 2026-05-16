"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const THEME_KEY = "zentra.theme.v1";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
    // Update the PWA / browser chrome colour so the OS status bar and
    // Android address bar match the chosen theme — otherwise the user
    // gets a cream-coloured strip on a dark-mode app.
    updateThemeColorMeta(next ? "#1d1813" : "#efe7d6");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex-shrink-0 rounded-lg p-2 transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#2d2820]"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ color: "var(--zn-ink-3)" }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

/**
 * Replace the <meta name="theme-color"> tags (both light and dark
 * media-query variants) with a single, unconditional value so the
 * user's manual choice wins over prefers-color-scheme. The OS status
 * bar / address bar updates immediately on mobile.
 */
function updateThemeColorMeta(color: string): void {
  if (typeof document === "undefined") return;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);
}
