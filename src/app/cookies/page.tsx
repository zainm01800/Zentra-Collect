import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookies",
  description: "How Zentra Flow uses cookies.",
};

export default function CookiesPage() {
  return (
    <LegalPage kicker="Legal" title="Cookies" lastUpdated="10 May 2026">
      <Section title="Short version">
        <p>
          Zentra Flow uses only the cookies it needs to keep you signed in
          and the service running. We do not use third-party advertising,
          tracking, or social-media cookies.
        </p>
      </Section>

      <Section title="What we set">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Session cookies</strong> — keep you signed in. Expire when you close the browser or sign out.</li>
          <li><strong>Preference cookies</strong> — remember your view settings (e.g. portfolio vs single-business view). Stored locally in your browser, not sent to our servers.</li>
          <li><strong>Demo state</strong> — when you try the demo, your sample-data progress is kept in your browser&apos;s localStorage, not on our servers.</li>
        </ul>
      </Section>

      <Section title="What we don&apos;t set">
        <ul className="list-disc pl-5 space-y-1">
          <li>No advertising cookies.</li>
          <li>No third-party trackers (no Google Analytics, Facebook Pixel, etc).</li>
          <li>No cross-site tracking.</li>
        </ul>
      </Section>

      <Section title="Analytics (Plausible)">
        <p>
          When enabled in production, we use{" "}
          <a href="https://plausible.io/data-policy" className="underline underline-offset-2" rel="noopener">
            Plausible Analytics
          </a>{" "}
          to count anonymous page visits — never tied to an identifiable
          person, never shared, never sold. Plausible is independently hosted
          in the EU, sets <strong>no cookies</strong>, and does not collect
          any personal data — which is why no consent banner is needed under
          UK PECR rules.
        </p>
        <p>
          If you still prefer to opt out, install a content blocker (uBlock
          Origin, Brave) — Plausible respects them. Your experience of the
          product is unchanged either way.
        </p>
      </Section>

      <Section title="Error tracking (Sentry)">
        <p>
          When enabled, we use Sentry to record uncaught errors so we can fix
          them. Sentry only runs <em>after</em> an error and we explicitly
          disable PII collection (IP addresses are not sent). No cookies are set
          for this purpose.
        </p>
      </Section>

      <Section title="Managing cookies in your browser">
        <p>
          You can clear cookies and localStorage at any time from your
          browser&apos;s settings. Doing so will sign you out and reset any
          demo progress.
        </p>
      </Section>
    </LegalPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[18px] font-semibold mb-2 text-[#1d1813]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
