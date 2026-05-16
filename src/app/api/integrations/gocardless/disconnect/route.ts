/**
 * POST /api/integrations/gocardless/disconnect
 *
 * Removes the user's GoCardless OAuth tokens.
 */

import { NextResponse } from "next/server";
import {
  deleteConnection,
  getActiveAccountId,
} from "@/lib/integrations/oauth-store";

export async function POST() {
  const accountId = await getActiveAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    await deleteConnection(accountId, "gocardless");
  } catch (err) {
    console.error("[gocardless/disconnect]", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
