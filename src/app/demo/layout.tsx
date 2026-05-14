import type { Metadata } from "next";
import { DemoShell } from "@/components/demo-shell";

export const metadata: Metadata = {
  title: "Demo · Zentra Flow",
  description:
    "Explore Zentra Flow with realistic sample data. See your ranked chase plan, draft messages, and customer view — no account needed.",
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DemoShell>{children}</DemoShell>;
}
