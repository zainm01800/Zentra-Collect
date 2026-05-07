import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "£19",
    description: "For solo consultants and tiny teams chasing a small ledger.",
  },
  {
    name: "Pro",
    price: "£39",
    description: "For agencies that need a daily credit-control routine.",
  },
  {
    name: "Agency",
    price: "£99",
    description: "For teams managing more clients, promises, and escalations.",
  },
];

export function PricingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <Card
          key={plan.name}
          className={plan.name === "Pro" ? "rounded-lg border-zinc-950" : "rounded-lg"}
        >
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-semibold">{plan.price}</span>
              <span className="pb-1 text-sm text-muted-foreground">/month</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{plan.description}</p>
            <div className="space-y-2 text-sm">
              {[
                "Xero invoice sync",
                "Daily chase queue",
                "AI reminder drafts",
                "Promises and dispute tracking",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600" />
                  {feature}
                </div>
              ))}
            </div>
            <Button className="w-full" variant={plan.name === "Pro" ? "default" : "outline"}>
              Start {plan.name}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
