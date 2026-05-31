"use server";

/**
 * src/actions/intake.ts
 *
 * Server actions for the client data intake flow.
 * Bookkeepers call createIntakeToken() to get a shareable upload URL
 * for a specific client ledger.
 */

import {
  createSupabaseServerClient,
  hasSupabaseServerConfig,
} from "@/lib/supabase/server";

// ── Shared auth helper ────────────────────────────────────────────────────────

async function getAccountContext() {
  if (!hasSupabaseServerConfig()) return { error: "Database not configured" as const };
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return { error: "No account found" as const };
  return { supabase, accountId: member.account_id as string, user };
}

// ── createIntakeToken ─────────────────────────────────────────────────────────

export interface CreateIntakeTokenResult {
  url?:   string;
  error?: string;
}

/**
 * Creates a 30-day intake token for a client and returns the full URL
 * the bookkeeper can share with their client.
 */
export async function createIntakeToken(
  clientId:   string,
  clientName: string,
): Promise<CreateIntakeTokenResult> {
  if (!hasSupabaseServerConfig()) {
    return { error: "Database not configured" };
  }

  const supabase = await createSupabaseServerClient();

  // Get the authenticated user + their account
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  if (!member) return { error: "No account found" };

  // Get bookkeeper name from the user profile (email username as fallback)
  const bookkeeperName = user.user_metadata?.full_name
    ?? user.email?.split("@")[0]
    ?? "Your bookkeeper";

  // Insert the token — Supabase generates a unique `token` via default expression
  const { data: row, error } = await supabase
    .from("zentra_intake_tokens")
    .insert({
      account_id:      member.account_id,
      client_id:       clientId,
      client_name:     clientName,
      bookkeeper_name: bookkeeperName,
    })
    .select("token")
    .single();

  if (error || !row?.token) {
    console.error("[createIntakeToken] insert failed:", error);
    return { error: "Could not generate link. Please try again." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zentracollect.co.uk";
  return { url: `${baseUrl}/intake/${row.token}` };
}

// ── getPendingIntakeUploads ───────────────────────────────────────────────────

export interface PendingUpload {
  id:            string;
  clientId:      string;
  uploadType:    string;
  fileName:      string;
  fileSizeBytes: number | null;
  uploadedAt:    string;
}

/**
 * Returns all not-yet-imported uploads for the signed-in bookkeeper's account,
 * newest first. Raw file content is intentionally excluded here (it can be
 * large) — fetch it on demand with getIntakeUploadContent().
 */
export async function getPendingIntakeUploads(): Promise<{ uploads: PendingUpload[]; error?: string }> {
  const ctx = await getAccountContext();
  if ("error" in ctx) return { uploads: [], error: ctx.error };

  const { data, error } = await ctx.supabase
    .from("zentra_intake_uploads")
    .select("id, client_id, upload_type, file_name, file_size_bytes, uploaded_at")
    .eq("account_id", ctx.accountId)
    .is("imported_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) {
    console.error("[getPendingIntakeUploads] failed:", error);
    return { uploads: [], error: "Could not load uploads." };
  }

  return {
    uploads: (data ?? []).map((r) => ({
      id:            r.id as string,
      clientId:      r.client_id as string,
      uploadType:    r.upload_type as string,
      fileName:      r.file_name as string,
      fileSizeBytes: (r.file_size_bytes as number | null) ?? null,
      uploadedAt:    r.uploaded_at as string,
    })),
  };
}

// ── getIntakeUploadContent ────────────────────────────────────────────────────

/** Returns the raw file content for a single upload (for download / import). */
export async function getIntakeUploadContent(
  uploadId: string,
): Promise<{ fileName?: string; uploadType?: string; rawContent?: string; error?: string }> {
  const ctx = await getAccountContext();
  if ("error" in ctx) return { error: ctx.error };

  const { data, error } = await ctx.supabase
    .from("zentra_intake_uploads")
    .select("file_name, upload_type, raw_content")
    .eq("account_id", ctx.accountId)
    .eq("id", uploadId)
    .maybeSingle();

  if (error || !data) {
    console.error("[getIntakeUploadContent] failed:", error);
    return { error: "Could not load file." };
  }

  return {
    fileName:   data.file_name as string,
    uploadType: data.upload_type as string,
    rawContent: data.raw_content as string,
  };
}

// ── markIntakeUploadImported ──────────────────────────────────────────────────

/** Marks an upload as handled so it drops out of the pending list. */
export async function markIntakeUploadImported(
  uploadId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await getAccountContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await ctx.supabase
    .from("zentra_intake_uploads")
    .update({ imported_at: new Date().toISOString() })
    .eq("account_id", ctx.accountId)
    .eq("id", uploadId);

  if (error) {
    console.error("[markIntakeUploadImported] failed:", error);
    return { ok: false, error: "Could not update." };
  }
  return { ok: true };
}
