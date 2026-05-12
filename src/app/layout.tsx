import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShellWrapper } from "@/components/app-shell-wrapper";
import "./globals.css";

// Plausible — no-op until NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set.
// Privacy-respecting analytics: no cookies, no personal data, no cross-site tracking.
const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const plausibleSrc =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL ?? "https://plausible.io/js/script.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Zentra Flow — Collections decisioning for UK bookkeepers",
    template: "%s · Zentra Flow",
  },
  description:
    "Upload overdue invoices. Get a ranked chase plan in minutes. Action + reason + draft message — you review and send. Built for UK bookkeepers and small businesses.",
  applicationName: "Zentra Flow",
  authors: [{ name: "Zentra" }],
  keywords: [
    "AR ageing",
    "collections decisioning",
    "invoice chasing",
    "bookkeeper software UK",
    "credit control",
    "Xero overdue",
    "small business cashflow",
  ],
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "Zentra Flow",
    title: "Zentra Flow — Collections decisioning for UK bookkeepers",
    description:
      "Upload overdue invoices. Get a ranked chase plan in minutes. Action + reason + draft message — you review and send.",
    url: SITE_URL,
    // Image is auto-discovered from src/app/opengraph-image.tsx (dynamic PNG via next/og).
    // The /og.svg in /public is a fallback for routes without their own opengraph-image.
  },
  twitter: {
    card: "summary_large_image",
    title: "Zentra Flow — Collections decisioning",
    description: "Upload overdue invoices. Get a ranked chase plan in minutes.",
    // Image auto-discovered from src/app/twitter-image.tsx (or falls back to opengraph-image.tsx)
  },
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

export const viewport = {
  themeColor: "#efe7d6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Theme init — runs before hydration to prevent flash of wrong mode */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('zentra.theme.v1');if(t==='dark')document.documentElement.classList.add('dark');}catch{}})();`,
          }}
        />
        {plausibleDomain ? (
          <Script
            defer
            data-domain={plausibleDomain}
            src={plausibleSrc}
            strategy="afterInteractive"
          />
        ) : null}
        <TooltipProvider>
          <AppShellWrapper>{children}</AppShellWrapper>
        </TooltipProvider>
      </body>
    </html>
  );
}
