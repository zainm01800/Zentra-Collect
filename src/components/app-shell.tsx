import Link from "next/link";
import { CreditCard, FileText, FileUp, LayoutDashboard, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/view-toggle";
import { TrialStatusBanner } from "@/components/trial-banners";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/chase-today", label: "Collections", icon: CreditCard },
  { href: "/import", label: "Import", icon: FileUp },
  { href: "/digest", label: "Digest", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fbf8f1] text-neutral-950">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[#fbf8f1]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-neutral-950 text-base font-bold text-white">
              Z
            </span>
            <span className="leading-tight">
              <span className="block tracking-[0.18em]">ZENTRA</span>
              <span className="block text-[0.68rem] font-medium uppercase tracking-[0.18em] text-neutral-500">
                Collect
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <Button key={`${item.href}-${item.label}`} asChild variant="ghost" className="rounded-full">
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <ViewToggle />
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-black/10 px-4 py-2 md:hidden">
          {nav.map((item) => (
            <Button key={`${item.href}-${item.label}`} asChild variant="ghost" className="shrink-0 rounded-full">
              <Link href={item.href}>
                <item.icon className="size-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <TrialStatusBanner />
        {children}
      </main>
    </div>
  );
}
