"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

// Routes that render their own layout (no AppShell needed from root)
const PUBLIC_PREFIXES = [
  "/login",
  "/pricing",
  "/demo",
  "/onboarding",
  "/beta-request",
  "/request-access",
  "/cookies",
  "/privacy",
  "/terms",
  "/admin",
  "/auth",
  "/free-tools",
  "/tools",
  "/pay",
  "/trust",
  "/help",
  "/trader-waitlist",
  "/reset-password",
];

export function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";

  // Landing page: no shell
  if (pathname === "/") return <>{children}</>;

  // Public / auth pages: no shell
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}
