"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * ZnInput — single source of truth for text inputs across the app.
 *
 * Audit §4: previously every component restyled its inputs inline,
 * which is why dark mode regressed repeatedly. Use this primitive
 * instead of <input> when you want the Zentra Collect look.
 *
 * For full custom styling, pass className — it merges with the base.
 */

export type ZnInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const ZnInput = React.forwardRef<HTMLInputElement, ZnInputProps>(
  function ZnInput({ className, style, ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={cn(
          "w-full rounded-[10px] border px-3 py-2.5 text-[13.5px] outline-none transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2",
          className,
        )}
        style={{
          background: "var(--zn-surface)",
          borderColor: "var(--zn-line)",
          color: "var(--zn-ink)",
          ...style,
        }}
      />
    );
  },
);

export type ZnTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const ZnTextarea = React.forwardRef<HTMLTextAreaElement, ZnTextareaProps>(
  function ZnTextarea({ className, style, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        {...rest}
        className={cn(
          "w-full rounded-[10px] border px-3 py-2.5 text-[13.5px] outline-none transition-colors resize-y",
          "focus-visible:outline-2 focus-visible:outline-offset-2",
          className,
        )}
        style={{
          background: "var(--zn-surface)",
          borderColor: "var(--zn-line)",
          color: "var(--zn-ink)",
          ...style,
        }}
      />
    );
  },
);
