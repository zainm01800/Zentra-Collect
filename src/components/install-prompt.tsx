"use client";

/**
 * Install prompt — mobile-first PWA installation nudge.
 *
 * Strategy:
 *   - On Android/Chrome: listen for `beforeinstallprompt`, stash the
 *     event, show a small banner; click → call .prompt() on the event.
 *   - On iOS Safari: there's no install API. Show a one-time tooltip
 *     pointing at the Share menu with instructions.
 *
 * Auto-suppressed when:
 *   - The app is already running in standalone mode (display-mode media)
 *   - User has dismissed the banner once (localStorage flag)
 *   - We're on desktop (md+ breakpoint via Tailwind)
 */

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "zn:install-prompt-dismissed:v1";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed? Bail.
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // iOS Safari sets navigator.standalone when launched from home screen.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((navigator as any).standalone) return;

    // Previously dismissed?
    if (window.localStorage.getItem(DISMISS_KEY)) return;

    // ── Android / Chrome path ────────────────────────────────────────────
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // ── iOS path (no install API) ────────────────────────────────────────
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !/(CriOS|FxiOS)/.test(ua);
    if (isIos) {
      setIosHint(true);
      setShow(true);
    }

    // Confirm install if it fires (clears the banner cleanly)
    const onInstalled = () => {
      window.localStorage.setItem(DISMISS_KEY, "1");
      setShow(false);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(DISMISS_KEY, "1");
        }
      }
    } finally {
      setDeferred(null);
      setShow(false);
    }
  }

  // Position above the mobile bottom nav (which is at bottom-0 with safe-area
  // padding). The bottom nav is ~64px tall + safe-area. We sit just above it
  // and only render on mobile (md:hidden).
  return (
    <div
      className="md:hidden fixed left-3 right-3 z-30 rounded-xl px-3 py-3"
      style={{
        background: "var(--zn-ink)",
        color:      "var(--zn-bg)",
        boxShadow:  "0 8px 24px rgba(0,0,0,0.2)",
        bottom:     "calc(5rem + env(safe-area-inset-bottom))",
      }}
      role="dialog"
      aria-label="Install Zentra Collect"
    >
      <div className="flex items-start gap-3">
        <Download className="size-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight">Install Zentra Collect</p>
          {iosHint ? (
            <p className="text-[11.5px] leading-snug mt-1 opacity-80 flex items-center gap-1.5">
              Tap <Share className="size-3 inline" /> Share, then &ldquo;Add to Home Screen&rdquo; for quicker access.
            </p>
          ) : (
            <p className="text-[11.5px] leading-snug mt-1 opacity-80">
              Add to home screen for full-screen mode and faster launches.
            </p>
          )}
        </div>
        {!iosHint && deferred && (
          <button
            type="button"
            onClick={install}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold shrink-0"
            style={{ background: "var(--zn-bg)", color: "var(--zn-ink)" }}
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="p-1 rounded shrink-0 opacity-60 hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
