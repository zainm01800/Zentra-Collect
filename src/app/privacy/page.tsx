import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How Zentra Collect handles your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage kicker="Legal" title="Privacy notice" lastUpdated="10 May 2026">
      <Section title="Who is the controller?">
        <p>
          Zentra Ltd is the data controller for information you provide when
          using Zentra Collect. Contact:{" "}
          <a href="mailto:privacy@zentracollect.co.uk" className="underline underline-offset-2">privacy@zentracollect.co.uk</a>.
        </p>
        <p>
          We are registered with the UK Information Commissioner&apos;s Office
          (ICO). Registration details available on request.
        </p>
      </Section>

      <Section title="What data we process">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account data</strong> — name, business name, email, password (hashed).</li>
          <li><strong>Invoice data you upload</strong> — customer names, contact emails, invoice references, amounts, due dates, notes.</li>
          <li><strong>Usage data</strong> — pages visited, features used, error logs (anonymised).</li>
          <li><strong>Billing data</strong> — handled by Stripe; we store only the minimum necessary identifiers.</li>
        </ul>
      </Section>

      <Section title="Lawful basis">
        <p>
          We process account data and invoice data on the basis of{" "}
          <strong>contract</strong> (to provide the service you signed up for),
          and usage data on the basis of <strong>legitimate interest</strong>
          (improving the service).
        </p>
        <p>
          Where our customers (you) upload data about <em>your</em> customers,
          you act as the controller of that data and we act as the processor on
          your behalf. A data processing agreement (DPA) is available on
          request.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          We keep your invoice data for as long as your account is active, plus
          30 days after closure. After that, it is deleted from our live
          systems and from backups within a further 60 days.
        </p>
      </Section>

      <Section title="Who we share it with">
        <ul className="list-disc pl-5 space-y-1">
          <li>Hosting / infrastructure providers (Vercel, Supabase) for the operation of the service.</li>
          <li>AI providers (OpenAI, Google) only when you generate a draft message — see &quot;AI&quot; below.</li>
          <li>Stripe for billing.</li>
          <li>Where required by UK law or court order.</li>
        </ul>
        <p>We do not sell your data and we do not use it to train third-party AI models.</p>
      </Section>

      <Section title="AI processing">
        <p>
          When you generate a draft message, the relevant invoice context is
          sent to our AI provider (OpenAI or Google). These providers do not
          retain the data for training. AI is used for drafting messages,
          classifying replies, and suggesting column mappings on import — never
          for ranking decisions, which are 100% rule-based.
        </p>
      </Section>

      <Section title="Your rights">
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal data we hold about you.</li>
          <li>Correct anything inaccurate.</li>
          <li>Request deletion (right to be forgotten).</li>
          <li>Export your data in a machine-readable format.</li>
          <li>Object to processing or withdraw consent.</li>
          <li>Complain to the UK Information Commissioner&apos;s Office (<a href="https://ico.org.uk" className="underline underline-offset-2" rel="noopener">ico.org.uk</a>).</li>
        </ul>
      </Section>

      <Section title="Security">
        <p>
          Data is encrypted in transit (TLS 1.2+) and at rest. Access is
          restricted to staff who need it. We log access and review it
          periodically.
        </p>
      </Section>
    </LegalPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[18px] font-semibold mb-2 text-[#1d1813] dark:text-[#f0e8d5]">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
