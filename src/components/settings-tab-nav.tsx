"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings", label: "Workspace" },
  { href: "/settings/account", label: "Account & Billing" },
] as const;

export function SettingsTabNav() {
  const pathname = usePathname();

  return (
    <nav className="flex border-b border-black/10" aria-label="Settings sections">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 pb-3 pt-1 text-sm font-medium transition-colors ${
              isActive
                ? "border-neutral-950 text-neutral-950"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
