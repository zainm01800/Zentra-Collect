"use client";

/**
 * PushPermission
 *
 * Shows a subtle banner asking the user to enable push notifications.
 * Appears once per browser after a short delay, doesn't block the UI,
 * and is permanently dismissed on "No thanks" or after grant/denial.
 *
 * Usage: drop into the authenticated app shell.
 */

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, X } from "lucide-react";

const DISMISSED_KEY = "zentra.push.dismissed.v1";
const SUBSCRIBED_KEY = "zentra.push.subscribed.v1";

type PermissionStatus = "idle" | "requesting" | "granted" | "denied" | "dismissed" | "unsupported";

// ── Helpers ────────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getOrCreateSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.warn("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.");
    return null;
  }

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: {
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      },
      userAgent: navigator.userAgent.slice(0, 200),
    }),
  });
}

async function removeSubscription(sub: PushSubscription): Promise<void> {
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}

// ── Component ──────────────────────────────────────────────────────────────────

interface PushPermissionProps {
  /** Delay in ms before showing the banner. Default 8 000 (8 s). */
  delayMs?: number;
}

export function PushPermission({ delayMs = 8000 }: PushPermissionProps) {
  const [status, setStatus] = useState<PermissionStatus>("idle");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Skip on server, in private mode, or if already handled
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (localStorage.getItem(DISMISSED_KEY)) {
      setStatus("dismissed");
      return;
    }
    if (localStorage.getItem(SUBSCRIBED_KEY)) {
      setStatus("granted");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    if (Notification.permission === "granted") {
      // Already granted but not subscribed — subscribe silently
      setStatus("granted");
      localStorage.setItem(SUBSCRIBED_KEY, "1");
      getOrCreateSubscription().then((sub) => {
        if (sub) saveSubscription(sub).catch(console.warn);
      });
      return;
    }

    // Show banner after delay
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  const handleEnable = useCallback(async () => {
    setStatus("requesting");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        localStorage.setItem(DISMISSED_KEY, "1");
        setVisible(false);
        return;
      }
      const sub = await getOrCreateSubscription();
      if (sub) {
        await saveSubscription(sub);
        localStorage.setItem(SUBSCRIBED_KEY, "1");
      }
      setStatus("granted");
      setVisible(false);
    } catch (err) {
      console.warn("[push] enable error:", err);
      setStatus("denied");
      setVisible(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setStatus("dismissed");
    setVisible(false);
  }, []);

  // Nothing to render in most cases
  if (!visible || status === "unsupported" || status === "dismissed" || status === "granted") {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-label="Enable push notifications"
      className="fixed bottom-20 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-[#e0d8cc] bg-[#efe7d6] p-4 shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
    >
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 rounded-full p-1 text-[#6b6259] hover:bg-[#e4dcd0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8481f]"
      >
        <X size={14} />
      </button>

      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d1813] text-[#efe7d6]">
          <Bell size={15} />
        </div>

        <div className="flex-1 pr-4">
          <p className="text-sm font-semibold text-[#1d1813]">
            Stay on top of overdue invoices
          </p>
          <p className="mt-0.5 text-xs text-[#6b6259]">
            Get a morning digest and escalation alerts without checking the app.
          </p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleEnable}
              disabled={status === "requesting"}
              className="flex-1 rounded-full bg-[#1d1813] px-3 py-1.5 text-xs font-medium text-[#efe7d6] transition-opacity hover:opacity-80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8481f]"
            >
              {status === "requesting" ? "Enabling…" : "Enable notifications"}
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-full border border-[#c8c0b4] px-3 py-1.5 text-xs font-medium text-[#6b6259] hover:bg-[#e4dcd0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8481f]"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Notification settings toggle (for the Settings page) ──────────────────────

interface NotificationToggleProps {
  className?: string;
}

export function NotificationToggle({ className }: NotificationToggleProps) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setSubscribed(Notification.permission === "granted" && !!localStorage.getItem(SUBSCRIBED_KEY));
  }, []);

  const toggle = useCallback(async () => {
    setLoading(true);
    try {
      if (subscribed) {
        // Unsubscribe
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) await removeSubscription(sub);
        }
        localStorage.removeItem(SUBSCRIBED_KEY);
        localStorage.removeItem(DISMISSED_KEY);
        setSubscribed(false);
      } else {
        // Subscribe
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          const sub = await getOrCreateSubscription();
          if (sub) {
            await saveSubscription(sub);
            localStorage.setItem(SUBSCRIBED_KEY, "1");
          }
          setSubscribed(true);
        }
      }
    } catch (err) {
      console.warn("[push] toggle error:", err);
    } finally {
      setLoading(false);
    }
  }, [subscribed]);

  if (subscribed === null) return null; // still checking

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        subscribed
          ? "border-[#1d1813] bg-[#1d1813] text-[#efe7d6] hover:bg-[#2d2820]"
          : "border-[#c8c0b4] text-[#6b6259] hover:bg-[#e4dcd0]"
      } ${className ?? ""}`}
    >
      {subscribed ? <Bell size={15} /> : <BellOff size={15} />}
      {loading
        ? "Updating…"
        : subscribed
          ? "Notifications on"
          : "Enable notifications"}
    </button>
  );
}
