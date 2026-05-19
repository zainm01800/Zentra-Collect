import type { Metadata } from "next";
import Link from "next/link";
import { Shield, Lock, Eye, Bot, Ban, FileText, Mail, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Trust & Security",
  description: "How Zentra Collect handles your data, what AI does (and doesn't) do, and our commitment to human approval on every action.",
};

function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="zn-card px-6 py-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: "var(--zn-surface-2)" }}>
          <Icon className="size-4" style={{ color: "var(--zn-ink-2)" }} />
        </div>
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--zn-ink)" }}>{title}</h2>
      </div>
      <div className="space-y-3 text-[13.5px] leading-relaxed" style={{ color: "var(--zn-ink-2)" }}>
        {children}
      </div>
    </div>
  );
}

function Fact({ label, value, safe = true }: { label: string; value: string; safe?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--zn-line-soft)" }}>
      <CheckCircle className="size-4 mt-0.5 flex-shrink-0" style={{ color: safe ? "var(--zn-safe)" : "var(--zn-ink-3)" }} />
      <div className="flex-1 min-w-0">
        <span className="font-medium" style={{ color: "var(--zn-ink)" }}>{label}: </span>
        <span style={{ color: "var(--zn-ink-2)" }}>{value}</span>
      </div>
    </div>
  );
}

export default function TrustPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-12">

      {/* Header */}
      <div className="pt-2">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]" style={{ color: "var(--zn-ink)" }}>
          Trust & Security
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--zn-ink-3)" }}>
          No hidden terms. No surprise data sharing. Every decision you can audit.
          This page tells you exactly how Zentra Collect works and what we promise.
        </p>
      </div>

      {/* Where your data lives */}
      <Section icon={Lock} title="Where your data lives">
        <Fact label="Hosting" value="EU-based servers (Supabase, Frankfurt region). Your data never leaves the EU." />
        <Fact label="Encryption in transit" value="TLS 1.2+ on every request. No unencrypted connections accepted." />
        <Fact label="Encryption at rest" value="AES-256 encryption on all stored invoice and customer data." />
        <Fact label="Backups" value="Daily automated backups with 30-day retention." />
        <Fact label="Who can see your data" value="Only you and the systems you explicitly connect (Xero, QuickBooks, etc.). Zentra staff access requires your consent." />
        <Fact label="Account isolation" value="Postgres row-level security (RLS) policies enforce that one account can never query another account's invoices, customers, mileage, quotes, or credit notes — even with a leaked database key." />
        <Fact label="Status & uptime" value="Live system status at status.zentracollect.co.uk — updated automatically on every incident." />
      </Section>

      {/* What AI does — and doesn't */}
      <Section icon={Bot} title="Exactly what AI does — and doesn't do">
        <p className="mb-3">
          Most AI-flavoured products are vague about what AI actually touches. We aren&apos;t.
        </p>
        <p className="font-semibold mb-2" style={{ color: "var(--zn-ink)" }}>AI is used for three things only:</p>
        <div className="space-y-2 mb-4">
          {[
            { n: "1", label: "Drafting message text", detail: "When you click Draft, AI writes a starting point. You see it, edit it, and decide whether to use it. AI never sends anything." },
            { n: "2", label: "Classifying customer replies", detail: "AI reads incoming replies and suggests a next action (paid, disputed, promised). You confirm before anything changes." },
            { n: "3", label: "Suggesting column mappings on import", detail: "When you upload a CSV, AI tries to match your columns to the expected fields. You confirm every mapping before data is saved." },
          ].map(({ n, label, detail }) => (
            <div key={n} className="flex gap-3 rounded-xl px-4 py-3" style={{ background: "var(--zn-surface-2)" }}>
              <span className="text-[12px] font-bold w-5 shrink-0 mt-0.5" style={{ color: "var(--zn-ink-3)" }}>{n}.</span>
              <div>
                <p className="font-medium text-[13px]" style={{ color: "var(--zn-ink)" }}>{label}</p>
                <p className="text-[12.5px] mt-0.5" style={{ color: "var(--zn-ink-3)" }}>{detail}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="font-semibold mb-2" style={{ color: "var(--zn-ink)" }}>Everything else is rules-based:</p>
        <p>
          Invoice ranking, priority scores, safety checks, scenario selection, overdue calculations,
          and outcome tracking are all deterministic logic. Same input, same output, every time.
          No black box. You can always ask &ldquo;why did this rank #1?&rdquo; and get a real answer.
        </p>
      </Section>

      {/* No auto-send */}
      <Section icon={Ban} title="No automatic sending — ever">
        <Fact label="Auto-send" value="Never. Human approval is required before every outbound message." />
        <Fact label="Your customers never see 'Zentra'" value="Drafts are signed with your name and business. No Zentra branding in messages." />
        <Fact label="You control the tone" value="Edit any draft before using it. The AI suggestion is a starting point, not a decision." />
        <Fact label="Audit trail" value="Every recommendation can be traced back to the rules and data that produced it." />
        <p className="mt-3 text-[13px] px-4 py-3 rounded-xl" style={{ background: "var(--zn-safe-soft)", color: "var(--zn-safe)" }}>
          We will never add auto-sending without explicit opt-in from you, and never as a default.
          This is a core product principle, not just a setting.
        </p>
      </Section>

      {/* Deletion & export */}
      <Section icon={FileText} title="Your data is yours">
        <Fact label="Export anytime" value="Download all your invoices, customers, and activity as CSV from Settings at any time." />
        <Fact label="Deletion on request" value="Email us and we will delete your account and all associated data within 7 working days." />
        <Fact label="On cancellation" value="Your data is retained for 30 days after cancellation so you can export it. After 30 days it is permanently deleted." />
        <Fact label="No selling your data" value="We do not sell, rent, or share your data with third parties for advertising or marketing." />
      </Section>

      {/* No trackers */}
      <Section icon={Eye} title="No third-party trackers in the app">
        <p>
          The Zentra Collect application (the part you log into) contains no third-party advertising
          trackers, no Facebook Pixel, no Google Analytics, and no cross-site tracking cookies.
        </p>
        <p className="mt-2">
          We use minimal, privacy-respecting analytics (page views only, no personal identifiers)
          to understand which features are used. You can opt out in Settings.
        </p>
        <Fact label="Cookies" value="Session cookie for authentication only. No tracking cookies in the app." />
        <Fact label="Third-party scripts" value="None in the authenticated app. Marketing site only." />
      </Section>

      {/* Contact */}
      <Section icon={Mail} title="Talk to us">
        <p>
          Have a question about your data, a deletion request, or a security concern?
          We respond to every message personally.
        </p>
        <div className="mt-3 rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--zn-surface-2)" }}>
          <Mail className="size-4 shrink-0" style={{ color: "var(--zn-ink-3)" }} />
          <a
            href="mailto:privacy@zentracollect.co.uk"
            className="text-[13.5px] font-medium hover:underline"
            style={{ color: "var(--zn-ink)" }}
          >
            privacy@zentracollect.co.uk
          </a>
        </div>
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--zn-ink-3)" }}>
          Zentra Collect is operated by [Company name], registered in England and Wales.
          UK ICO registration: [ICO number — add before launch].
        </p>
      </Section>

      {/* Footer links */}
      <div className="flex flex-wrap gap-4 text-[12.5px] pt-2" style={{ color: "var(--zn-ink-3)" }}>
        <Link href="/privacy" className="hover:underline">Privacy policy</Link>
        <Link href="/terms" className="hover:underline">Terms of service</Link>
        <Link href="/cookies" className="hover:underline">Cookie policy</Link>
        <a href="https://status.zentracollect.co.uk" target="_blank" rel="noopener noreferrer" className="hover:underline">System status</a>
        <Link href="/settings" className="hover:underline">Your account settings</Link>
      </div>
    </div>
  );
}
