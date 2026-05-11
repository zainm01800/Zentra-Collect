import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Terms of service for Zentra Flow.",
};

export default function TermsPage() {
  return (
    <LegalPage kicker="Legal" title="Terms of service" lastUpdated="10 May 2026">
      <Section title="1. Who we are">
        <p>
          Zentra Flow (the &quot;Service&quot;) is provided by Zentra Ltd
          (&quot;Zentra&quot;, &quot;we&quot;, &quot;us&quot;), a company
          registered in England &amp; Wales [company number to insert].
          Registered address: [address to insert]. Contact:{" "}
          <a href="mailto:hello@zentracollect.co.uk" className="underline underline-offset-2">hello@zentracollect.co.uk</a>.
        </p>
      </Section>

      <Section title="2. What Zentra does">
        <p>
          Zentra Flow is a decision-support and drafting tool. It analyses
          accounts-receivable data you upload, ranks invoices by recommended
          action, and drafts professional follow-up messages for you to review
          and send from your own email account.
        </p>
        <p>
          Zentra <strong>does not</strong> send messages on your behalf,
          provide legal, accounting, or tax advice, act as a debt collection
          agency, or take payments from your customers. You remain solely
          responsible for what you send and to whom.
        </p>
      </Section>

      <Section title="3. Your account">
        <p>
          You may try the demo using sample data. To use real data you must
          create an account, agree to these terms, and (on paid plans) pay the
          applicable fee. You are responsible for keeping your login secure
          and for all activity on your account.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>You agree not to use Zentra to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Send unsolicited or harassing communications.</li>
          <li>Threaten, intimidate, or impersonate any person or business.</li>
          <li>Process data you have no legal right to handle.</li>
          <li>Reverse-engineer or attempt to circumvent the Service.</li>
        </ul>
      </Section>

      <Section title="5. Plans, payment, and refunds">
        <p>
          Plans, prices, and limits are listed on our pricing page. Trials are
          14 days, no card required. Paid plans renew monthly until cancelled.
          You can cancel from the Settings page; cancellation takes effect at
          the end of the current billing period. We do not offer pro-rated
          refunds for partial months.
        </p>
      </Section>

      <Section title="6. Your data">
        <p>
          We process the data you upload (invoices, customer details,
          activity history) only to provide the Service. Full details are in
          our <a href="/privacy" className="underline underline-offset-2">Privacy Notice</a>.
          You retain ownership of your data and may export or delete it at any
          time.
        </p>
      </Section>

      <Section title="7. Service availability">
        <p>
          We aim for high availability but do not guarantee uninterrupted
          access. We may make changes to the Service, and we will give
          reasonable notice of changes that materially affect you.
        </p>
      </Section>

      <Section title="8. Liability">
        <p>
          To the maximum extent permitted by law, our total liability for any
          claim arising from the Service is limited to the fees you have paid
          us in the twelve months before the claim. We are not liable for
          indirect, consequential, or business losses.
        </p>
        <p>
          Nothing in these terms limits liability for death or personal injury
          caused by negligence, fraud, or any other liability that cannot be
          excluded under English law.
        </p>
      </Section>

      <Section title="9. Termination">
        <p>
          You may close your account at any time. We may suspend or terminate
          your account if you breach these terms or use the Service in a way
          that risks harm to others. We will give reasonable notice unless
          immediate action is necessary.
        </p>
      </Section>

      <Section title="10. Governing law">
        <p>
          These terms are governed by the laws of England &amp; Wales. The
          courts of England &amp; Wales have exclusive jurisdiction over any
          dispute.
        </p>
      </Section>

      <Section title="11. Changes to these terms">
        <p>
          We may update these terms. If a change materially affects you, we
          will notify you by email at least 14 days in advance.
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
