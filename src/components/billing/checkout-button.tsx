"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/browser";

interface CheckoutButtonProps {
  priceId: string;
  planId: string;
  cta: string;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
}

export function CheckoutButton({
  priceId,
  planId,
  cta,
  className,
  variant = "primary",
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function handleCheckout() {
    if (!hasSupabaseBrowserConfig()) {
      // If no Supabase, fall back to request-access page
      router.push("/request-access");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceId, planId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === "Unauthorized") {
        router.push("/login?redirect=/pricing");
      } else {
        throw new Error(data.error || "Checkout failed");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      // Fallback to request access on error
      router.push("/request-access");
    } finally {
      setIsLoading(false);
    }
  }

  const baseStyles = "rounded-full px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 w-full";
  const variants = {
    primary: "bg-neutral-950 text-white hover:bg-neutral-800",
    secondary: "border border-black/15 bg-white dark:bg-[#211d17] text-neutral-950 dark:text-[#f0e8d5] hover:bg-neutral-50 dark:bg-[#211d17]",
    outline: "border border-black/15 bg-white dark:bg-[#211d17] text-neutral-700 dark:text-[#d8ccb5] hover:bg-neutral-50 dark:bg-[#211d17]",
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={isLoading}
      className={`${baseStyles} ${variants[variant]} ${className} disabled:opacity-70 disabled:cursor-not-allowed`}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          {cta}
          <ArrowRight className="size-3.5" />
        </>
      )}
    </button>
  );
}
