import { AppShell } from "@/components/app-shell";
import { ImportGate } from "@/components/import-gate";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Import",
  description: "Upload an AR ageing or unpaid invoice export and turn it into a ranked chase plan.",
};

export default function ImportPage() {
  return (
    <AppShell>
      <ImportGate />
    </AppShell>
  );
}
