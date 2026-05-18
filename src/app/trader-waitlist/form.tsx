"use client";

import { useState } from "react";
import { joinTraderWaitlistAction } from "@/actions/trader-waitlist";

export function TraderWaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setState("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    setState("submitting");
    setErrorMessage("");
    try {
      const result = await joinTraderWaitlistAction({ email });
      if (result.ok) {
        setState("success");
      } else {
        setState("error");
        setErrorMessage(result.error ?? "Couldn't save you to the waitlist. Try again later.");
      }
    } catch {
      setState("error");
      setErrorMessage("Network error. Try again in a moment.");
    }
  }

  if (state === "success") {
    return (
      <div
        className="rounded-2xl p-6 text-center"
        style={{ background: "var(--zn-safe-soft)", border: "1px solid var(--zn-safe)" }}
      >
        <p className="text-[15px] font-semibold" style={{ color: "var(--zn-safe)" }}>
          You&rsquo;re on the list.
        </p>
        <p className="mt-2 text-[13px]" style={{ color: "var(--zn-ink-2)" }}>
          We&rsquo;ll email <strong>{email}</strong> when Trader launches.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourbusiness.co.uk"
        className="flex-1 rounded-full px-4 py-3 text-[14px] border"
        style={{ borderColor: "var(--zn-line)" }}
        disabled={state === "submitting"}
      />
      <button
        type="submit"
        disabled={state === "submitting"}
        className="rounded-full px-5 py-3 text-[14px] font-semibold disabled:opacity-50"
        style={{ background: "var(--zn-ink)", color: "var(--zn-bg)" }}
      >
        {state === "submitting" ? "Joining…" : "Join waitlist"}
      </button>
      {state === "error" && (
        <p className="text-[12px] mt-1 sm:mt-0 sm:absolute"
           style={{ color: "var(--zn-risk)" }}>
          {errorMessage}
        </p>
      )}
    </form>
  );
}
