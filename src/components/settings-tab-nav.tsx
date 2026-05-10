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
    <nav className="zn-tabs" aria-label="Settings sections">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-selected={isActive}
            className="zn-tab"
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
