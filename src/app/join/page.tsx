/**
 * /join?ref=ZC-XXXXXX
 *
 * CB-2: previously a 404 — every referral link minted from the
 * "Invite a colleague" card landed on a dead page, killing the
 * +1-bonus-ledger growth loop. This route captures the referral
 * code into a 30-day cookie and routes the visitor into the signup
 * flow.
 *
 * The actual attribution (credit the referrer when the new account
 * activates) is handled wherever signup completion is finalised;
 * this page just makes sure the code follows the visitor.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "You're invited",
  robots: { index: false, follow: true },
};

const REFERRAL_COOKIE = "zn_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const ref = (params.ref ?? "").trim();

  if (ref && /^ZC-[A-Z0-9]{4,16}$/i.test(ref)) {
    const jar = await cookies();
    jar.set(REFERRAL_COOKIE, ref.toUpperCase(), {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: false,        // readable from client so signup form can show it
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  // Always route to the create-account flow, with the ref preserved in the URL
  // as a defensive backup in case the cookie was blocked.
  const target = ref
    ? `/login?mode=signup&ref=${encodeURIComponent(ref)}`
    : "/login?mode=signup";
  redirect(target);
}
