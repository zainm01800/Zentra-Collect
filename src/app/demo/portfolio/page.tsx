"use client";

/**
 * /demo/portfolio — Client portfolio overview (Practice / bookkeeper plan demo)
 *
 * Renders the existing PortfolioGate component which automatically shows
 * the DemoPortfolio view when no real account is present.
 */

import { PortfolioGate } from "@/components/portfolio-gate";

export default function DemoPortfolioPage() {
  return <PortfolioGate />;
}
