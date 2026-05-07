import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <Card className="w-full max-w-md rounded-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-zinc-950 text-white">
            <Sparkles className="size-5" />
          </div>
          <CardTitle className="mt-4 text-2xl">Sign in to CashPilot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@agency.co.uk" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Password" />
          </div>
          <Button asChild className="w-full">
            <Link href="/dashboard">Continue to demo</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Auth is mocked for the MVP. Supabase is the intended production auth layer.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
