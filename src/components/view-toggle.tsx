"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function ViewToggle() {
  const pathname = usePathname();
  const isBookkeeper = pathname.startsWith("/portfolio");

  return (
    <div className="flex shrink-0 items-center rounded-full border border-black/10 dark:border-white/10 bg-[#fbf8f1] dark:bg-[#211d17] p-0.5 text-xs font-medium">
      <Link
        href="/dashboard"
        className={cn(
          "whitespace-nowrap rounded-full px-3 py-1 transition-colors",
          !isBookkeeper
            ? "bg-neutral-950 text-white"
            : "text-neutral-600 dark:text-[#8a7d69] hover:text-neutral-900",
        )}
      >
        Single business
      </Link>
      <Link
        href="/portfolio"
        className={cn(
          "whitespace-nowrap rounded-full px-3 py-1 transition-colors",
          isBookkeeper
            ? "bg-neutral-950 text-white"
            : "text-neutral-600 dark:text-[#8a7d69] hover:text-neutral-900",
        )}
      >
        Bookkeeper
      </Link>
    </div>
  );
}
