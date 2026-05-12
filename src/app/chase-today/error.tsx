"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <div className="max-w-md rounded-lg border bg-white dark:bg-[#211d17] p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-amber-600" />
        <h1 className="mt-4 text-xl font-semibold">Queue failed to load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The invoice queue could not be prepared. Try again before sending or
          marking any reminders.
        </p>
        <Button onClick={reset} className="mt-4">
          Reload queue
        </Button>
      </div>
    </main>
  );
}
