"use client";

/**
 * src/components/workspace-switcher.tsx
 *
 * Shows the active client and lets the bookkeeper switch between their portfolio
 * clients. Persists the selection to localStorage. In non-bookkeeper (demo
 * direct-business) mode, shows the business name only.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Briefcase } from "lucide-react";
import { demoBookkeeperClients, demoSingleBusiness } from "@/lib/demo-data/zentra-demo-data";
import { readLocalAccount } from "@/lib/demo-auth";

const ACTIVE_CLIENT_KEY = "zentra.activeClientId.v1";

export interface ActiveWorkspace {
  id: string;
  name: string;
  label: string;
}

const DIRECT_WORKSPACE: ActiveWorkspace = {
  id: "direct",
  name: demoSingleBusiness.tradingName ?? demoSingleBusiness.name,
  label: "Direct",
};

const BOOKKEEPER_WORKSPACES: ActiveWorkspace[] = [
  { id: "all", name: "All clients", label: "Portfolio overview" },
  ...demoBookkeeperClients.map((c) => ({
    id: c.id,
    name: c.business.tradingName ?? c.business.name,
    label: c.portfolioLabel,
  })),
];

function readActiveId(): string {
  if (typeof window === "undefined") return "direct";
  return window.localStorage.getItem(ACTIVE_CLIENT_KEY) ?? "direct";
}

function writeActiveId(id: string) {
  window.localStorage.setItem(ACTIVE_CLIENT_KEY, id);
}

export function WorkspaceSwitcher() {
  const [isDemo, setIsDemo] = useState(false);
  const [activeId, setActiveId] = useState("direct");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const local = readLocalAccount();
    setIsDemo(local?.planId === "demo");
    setActiveId(readActiveId());
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!isDemo) return null;

  const workspaces = BOOKKEEPER_WORKSPACES;
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  function select(id: string) {
    setActiveId(id);
    writeActiveId(id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors hover:bg-[#ece3cc] dark:hover:bg-[#28231c]"
        style={{
          background: "var(--zn-surface)",
          border: "1px solid var(--zn-line-soft)",
        }}
      >
        <div
          className="size-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--zn-accent)", color: "var(--zn-accent-ink)" }}
        >
          <Briefcase className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold truncate" style={{ color: "var(--zn-ink)" }}>
            {active.name}
          </p>
          <p className="text-[10.5px] truncate" style={{ color: "var(--zn-ink-3)" }}>
            {active.label}
          </p>
        </div>
        <ChevronDown
          className="size-3.5 flex-shrink-0 transition-transform"
          style={{
            color: "var(--zn-ink-3)",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-[10px] py-1 z-50 overflow-hidden"
          style={{
            background: "var(--zn-surface)",
            border: "1px solid var(--zn-line)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
          }}
        >
          {workspaces.map((w) => {
            const isActive = w.id === activeId;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => select(w.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
              >
                <div
                  className="size-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                  style={{
                    background: isActive ? "var(--zn-accent)" : "var(--zn-bg-2)",
                    color: isActive ? "var(--zn-accent-ink)" : "var(--zn-ink-3)",
                  }}
                >
                  {w.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
                    {w.name}
                  </p>
                  <p className="text-[10.5px] truncate" style={{ color: "var(--zn-ink-3)" }}>
                    {w.label}
                  </p>
                </div>
                {isActive && <Check className="size-3 flex-shrink-0" style={{ color: "var(--zn-accent)" }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
