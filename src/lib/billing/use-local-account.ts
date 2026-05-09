"use client";

import { useMemo, useSyncExternalStore } from "react";
import { demoUserStorageKey, normaliseLocalAccount, toBillingAccount } from "@/lib/demo-auth";
import type { DemoUser } from "@/lib/demo-auth";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("zentra-account-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("zentra-account-change", onStoreChange);
  };
}

function getSnapshot() {
  return window.localStorage.getItem(demoUserStorageKey);
}

function getServerSnapshot() {
  return null;
}

export function useLocalAccount() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const user = useMemo<DemoUser | null>(() => {
    if (!raw) return null;
    try {
      return normaliseLocalAccount(JSON.parse(raw) as Partial<DemoUser>);
    } catch {
      return null;
    }
  }, [raw]);
  const account = useMemo(() => (user ? toBillingAccount(user) : null), [user]);

  return { user, account };
}
