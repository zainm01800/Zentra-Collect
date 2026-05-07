import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BenefitCards, LandingHero } from "@/components/landing-hero";
import { PricingCards } from "@/components/pricing-cards";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <LandingHero />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <BenefitCards />
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-medium text-muted-foreground">The problem</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Overdue invoices quietly drain agency time and cash flow
            </h2>
          </div>
          <p className="text-lg leading-8 text-zinc-600">
            Most small agencies already know which invoices are late, but the
            chasing still gets postponed because it feels awkward, repetitive,
            and hard to prioritise. CashPilot turns that work into a calm daily
            queue with clear next actions.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Know who to chase, what to say, and when to escalate
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            "Connect Xero as the source of truth",
            "Review today's chase queue",
            "Approve the reminder draft",
            "Track promises, disputes, and paid invoices",
          ].map((step, index) => (
            <div key={step} className="rounded-lg border bg-white p-5">
              <div className="mb-6 flex size-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <h3 className="font-semibold">{step}</h3>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pricing preview</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Simple plans for agency credit control
              </h2>
            </div>
            <Button asChild>
              <Link href="/dashboard">
                Try demo
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <PricingCards />
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8">
        CashPilot helps with reminders and credit-control workflow. It does not
        provide legal or accounting advice.
      </footer>
    </main>
  );
}
