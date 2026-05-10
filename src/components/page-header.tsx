/**
 * PageHeader — the standard Zentra page header pattern from the design source.
 *
 * Shape:  kicker (mono uppercase)  +  display h1 (Newsreader serif)  +  optional sub  +  actions
 */

import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  sub,
  actions,
  size = "md",
}: {
  kicker?: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {kicker ? <div className="zn-label mb-1.5">{kicker}</div> : null}
        <h1 className={size === "lg" ? "zn-page-h1 zn-page-h1-lg" : "zn-page-h1"}>
          {title}
        </h1>
        {sub ? (
          <p className="mt-1.5 max-w-[580px] text-[13.5px] text-[#6b6253]">
            {sub}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
