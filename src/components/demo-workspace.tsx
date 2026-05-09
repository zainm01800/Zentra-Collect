"use client";

import Link from "next/link";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";

import { ZentraDashboard } from "@/components/zentra-dashboard";
import { demoInvoices } from "@/lib/demo-data/zentra-demo-data";

const demoNav = [
  { href: "/pricing", label: "Pricing" },
  { href: "/beta-request?type=bookkeeper", label: "Bookkeeper beta" },
  { href: "/login", label: "Start trial" },
];

export function DemoWorkspace() {
  return (
    <main className="min-h-screen bg-[#fbf8f1] text-neutral-950">

      <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6 lg:px-10">


        <ZentraDashboard initialInvoices={demoInvoices} demoMode />
      </div>
    </main>
  );
}
