"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf8f1] dark:bg-[#211d17] p-4">
      <div className="max-w-md rounded-3xl border border-black/10 dark:border-white/10 bg-white/75 p-8 text-center">
        <AlertTriangle className="mx-auto size-8 text-neutral-950 dark:text-[#f0e8d5]" />
        <h1 className="mt-4 text-2xl font-semibold text-neutral-950 dark:text-[#f0e8d5]">
          Collections plan could not load
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-[#8a7d69]">
          The import data or ranking rules failed to load. No reminders have
          been generated or sent.
        </p>
        <Button onClick={reset} className="mt-5 rounded-full bg-neutral-950 px-5 text-white">
          Try again
        </Button>
      </div>
    </main>
  );
}
