"use client";

/**
 * src/components/workspace-switcher.tsx
 *
 * Shows the active client workspace and lets the bookkeeper switch between
 * their portfolio clients.
 *
 * Modes:
 *   demo          – shows hardcoded demo bookkeeper clients
 *   bookkeeper    – shows real clients from localStorage + "Add client" form
 *   other plans   – hidden
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Briefcase, Plus, X } from "lucide-react";
import { demoBookkeeperClients } from "@/lib/demo-data/zentra-demo-data";
import { readLocalAccount } from "@/lib/demo-auth";
import {
  ACTIVE_CLIENT_KEY,
  readBookkeeperClients,
  saveBookkeeperClients,
  writeActiveClientId,
  generateClientId,
  type BookkeeperClient,
} from "@/lib/bookkeeper-clients";

export interface ActiveWorkspace {
  id: string;
  name: string;
  label: string;
}

// ── Demo mode workspaces (unchanged) ─────────────────────────────────────────
const DEMO_WORKSPACES: ActiveWorkspace[] = [
  { id: "all", name: "All clients", label: "Portfolio overview" },
  ...demoBookkeeperClients.map((c) => ({
    id: c.id,
    name: c.business.tradingName ?? c.business.name,
    label: c.portfolioLabel,
  })),
];

function readActiveId(): string {
  if (typeof window === "undefined") return "all";
  return window.localStorage.getItem(ACTIVE_CLIENT_KEY) ?? "all";
}

// ── Component ─────────────────────────────────────────────────────────────────
export function WorkspaceSwitcher() {
  const [mode, setMode]   = useState<"hidden" | "demo" | "live">("hidden");
  const [activeId, setActiveId]     = useState("all");
  const [open, setOpen]             = useState(false);
  const [clients, setClients]       = useState<BookkeeperClient[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName]       = useState("");
  const [newLabel, setNewLabel]     = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const local = readLocalAccount();
    if (!local) { setMode("hidden"); return; }

    if (local.planId === "demo") {
      setMode("demo");
      setActiveId(readActiveId());
      return;
    }

    // Check if account has bookkeeper feature
    // We import canAccessBookkeeperMode which takes a BillingAccount
    // For simplicity, check planId directly
    const bookkeeperPlanIds = ["founding_bookkeeper", "bookkeeper_starter", "bookkeeper_pro"];
    if (bookkeeperPlanIds.includes(local.planId)) {
      setMode("live");
      setActiveId(readActiveId());
      const stored = readBookkeeperClients();
      setClients(stored);
    } else {
      setMode("hidden");
    }
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddForm(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (mode === "hidden") return null;

  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (mode === "demo") {
    const workspaces = DEMO_WORKSPACES;
    const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

    function selectDemo(id: string) {
      setActiveId(id);
      writeActiveClientId(id);
      setOpen(false);
    }

    return (
      <div ref={ref} className="relative mb-4">
        <WorkspaceTrigger active={active} open={open} onClick={() => setOpen((v) => !v)} />
        {open && (
          <WorkspaceDropdown>
            {workspaces.map((w) => (
              <WorkspaceItem
                key={w.id}
                workspace={w}
                isActive={w.id === activeId}
                onClick={() => selectDemo(w.id)}
              />
            ))}
          </WorkspaceDropdown>
        )}
      </div>
    );
  }

  // ── Live bookkeeper mode ───────────────────────────────────────────────────
  const liveWorkspaces: ActiveWorkspace[] = [
    { id: "all", name: "All clients", label: "Portfolio overview" },
    ...clients.map((c) => {
      const importLabel = c.importedAt
        ? `Last import: ${new Date(c.importedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
        : "No imports yet";
      return { id: c.id, name: c.name, label: c.label || importLabel };
    }),
  ];
  const active = liveWorkspaces.find((w) => w.id === activeId) ?? liveWorkspaces[0];

  function selectLive(id: string) {
    setActiveId(id);
    writeActiveClientId(id);
    setOpen(false);
    setShowAddForm(false);
  }

  function addClient() {
    const name  = newName.trim();
    const label = newLabel.trim() || "Client ledger";
    if (!name) return;
    const newClient: BookkeeperClient = {
      id: generateClientId(),
      name,
      label,
    };
    const updated = [...clients, newClient];
    setClients(updated);
    saveBookkeeperClients(updated);
    setNewName("");
    setNewLabel("");
    setShowAddForm(false);
    selectLive(newClient.id);
  }

  return (
    <div ref={ref} className="relative mb-4">
      <WorkspaceTrigger active={active} open={open} onClick={() => setOpen((v) => !v)} />
      {open && (
        <WorkspaceDropdown>
          {liveWorkspaces.map((w) => (
            <WorkspaceItem
              key={w.id}
              workspace={w}
              isActive={w.id === activeId}
              onClick={() => selectLive(w.id)}
            />
          ))}

          {/* Add client row */}
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
              style={{ borderTop: "1px solid var(--zn-line-soft)" }}
            >
              <div
                className="size-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--zn-bg-2)" }}
              >
                <Plus className="size-3.5" style={{ color: "var(--zn-ink-3)" }} />
              </div>
              <span className="text-[12px] font-medium" style={{ color: "var(--zn-ink-3)" }}>
                Add client
              </span>
            </button>
          ) : (
            <div
              className="px-3 py-2.5 flex flex-col gap-2"
              style={{ borderTop: "1px solid var(--zn-line-soft)" }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] font-semibold" style={{ color: "var(--zn-ink-2)" }}>
                  New client
                </span>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setNewName(""); setNewLabel(""); }}
                >
                  <X className="size-3" style={{ color: "var(--zn-ink-3)" }} />
                </button>
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Business name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addClient(); }}
                className="w-full rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
                style={{
                  background: "var(--zn-surface)",
                  border: "1px solid var(--zn-line)",
                  color: "var(--zn-ink)",
                }}
              />
              <input
                type="text"
                placeholder="Label (optional)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addClient(); }}
                className="w-full rounded-lg px-2.5 py-1.5 text-[12px] outline-none"
                style={{
                  background: "var(--zn-surface)",
                  border: "1px solid var(--zn-line)",
                  color: "var(--zn-ink)",
                }}
              />
              <button
                type="button"
                onClick={addClient}
                disabled={!newName.trim()}
                className="zn-pill text-[11.5px] w-full justify-center"
                style={{ height: 30, opacity: newName.trim() ? 1 : 0.45 }}
              >
                Add client
              </button>
            </div>
          )}
        </WorkspaceDropdown>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function WorkspaceTrigger({
  active,
  open,
  onClick,
}: {
  active: ActiveWorkspace;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  );
}

function WorkspaceDropdown({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute top-full left-0 right-0 mt-1.5 rounded-[10px] py-1 z-50 overflow-hidden"
      style={{
        background: "var(--zn-surface)",
        border: "1px solid var(--zn-line)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
      }}
    >
      {children}
    </div>
  );
}

function WorkspaceItem({
  workspace,
  isActive,
  onClick,
}: {
  workspace: ActiveWorkspace;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#f3ecd8] dark:hover:bg-[#2d2820]"
    >
      <div
        className="size-6 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
        style={{
          background: isActive ? "var(--zn-accent)" : "var(--zn-bg-2)",
          color: isActive ? "var(--zn-accent-ink)" : "var(--zn-ink-3)",
        }}
      >
        {workspace.name.slice(0, 1)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate" style={{ color: "var(--zn-ink)" }}>
          {workspace.name}
        </p>
        <p className="text-[10.5px] truncate" style={{ color: "var(--zn-ink-3)" }}>
          {workspace.label}
        </p>
      </div>
      {isActive && <Check className="size-3 flex-shrink-0" style={{ color: "var(--zn-accent)" }} />}
    </button>
  );
}
