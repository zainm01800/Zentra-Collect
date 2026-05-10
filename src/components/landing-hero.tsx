import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function LandingHero() {
  return (
    <section className="border-b bg-white">
      <div className="mx-auto grid min-h-[680px] max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_520px] lg:px-8 lg:py-20">
        <div className="flex flex-col justify-center">
          <Badge variant="outline" className="w-fit">
            For small UK agencies using Xero
          </Badge>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 sm:text-6xl">
            Get paid faster without awkward invoice chasing
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          Zentra Collect turns overdue invoices into a ranked collections plan:
            who to chase, what to say, and when to escalate.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/demo" target="_blank" rel="noopener noreferrer">
                Try the demo workflow
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard">View dashboard</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-600 sm:flex-row sm:gap-5">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              Review-before-send AI drafts
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600" />
              Xero-first invoice data
            </span>
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full rounded-lg border bg-zinc-950 p-4 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="size-4" />
            Zentra Collect
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs text-emerald-200">
                Daily plan
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-zinc-400">Recommended action</p>
              <p className="mt-2 text-xl font-semibold">
                Chase 12 invoices today. Start with £33,480 high-risk overdue.
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                1 dispute needs resolving before payment can move.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Overdue", "£44,860"],
                ["Needs action", "12"],
                ["Promised", "1"],
                ["Disputed", "1"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-sm text-zinc-400">{label}</p>
                  <p className="mt-2 text-2xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              {[
                "BluePeak Design - £8,900 - Call customer",
                "Ashford Digital - £12,750 - Final notice candidate",
                "Riverbank Studios - confirm promised payment",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm"
                >
                  <CheckCircle2 className="size-4 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function BenefitCards() {
  const benefits = [
    {
      title: "Know who to chase today",
      copy: "A focused queue ranks invoices by urgency, value, history, promise dates, and dispute status.",
    },
    {
      title: "Approve safer reminders",
      copy: "Generate professional drafts with tone controls and guardrails before anything is sent.",
    },
    {
      title: "Track what happens next",
      copy: "Keep promises, disputes, calls, follow-ups, and payment history in the same workflow.",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {benefits.map((benefit) => (
        <Card key={benefit.title} className="rounded-lg">
          <CardContent className="p-6">
            <h3 className="font-semibold">{benefit.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {benefit.copy}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
