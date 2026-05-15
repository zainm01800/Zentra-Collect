/**
 * POST /api/integrations/xero/disconnect
 *
 * Removes the user's Xero OAuth tokens from storage. Does NOT revoke the
 * tokens on Xero's side — the user can do that manually from their Xero
 * "Connected Apps" page if they want.
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
    await deleteConnection(accountId, "xero");
  } catch (err) {
    console.error("[xero/disconnect]", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
