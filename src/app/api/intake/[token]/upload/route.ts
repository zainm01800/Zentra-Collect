/**
 * POST /api/intake/[token]/upload
 *
 * Public endpoint (no auth required). Validates the intake token then
 * stores the uploaded file content in zentra_intake_uploads.
 *
 * Body (JSON):
 *   uploadType    — "invoices" | "bank_statement" | "receipts" | "other"
 *   fileName      — original file name (e.g. "march-invoices.csv")
 *   fileSizeBytes — byte count
 *   rawContent    — file content as UTF-8 text or base64 dataURL
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_UPLOAD_TYPES = new Set(["invoices", "bank_statement", "receipts", "other"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB original file
// Stored payload cap. Base64 data URLs inflate ~33%, so a 5 MB file is ~6.7 MB
// of text — allow some headroom. This bounds what an attacker with a valid
// token can actually persist, regardless of the client-claimed fileSizeBytes.
const MAX_RAW_CHARS = 8 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    uploadType:    string;
    fileName:      string;
    fileSizeBytes: number;
    rawContent:    string;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { uploadType, fileName, fileSizeBytes, rawContent } = body;

  if (!VALID_UPLOAD_TYPES.has(uploadType)) {
    return NextResponse.json({ error: "Invalid upload type" }, { status: 400 });
  }

  if (!fileName || typeof rawContent !== "string" || rawContent.length === 0) {
    return NextResponse.json({ error: "fileName and rawContent are required" }, { status: 400 });
  }

  // Bound the ACTUAL payload we will store. fileSizeBytes is client-supplied
  // (and may be missing/spoofed), so it can't be the real guard.
  if (rawContent.length > MAX_RAW_CHARS) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }
  if (typeof fileSizeBytes === "number" && fileSizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
  }

  // ── Connect to Supabase with anon key (RLS enforces token validity) ────────
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Look up the intake token
  const { data: intakeToken, error: tokenError } = await supabase
    .from("zentra_intake_tokens")
    .select("id, account_id, client_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenError || !intakeToken) {
    return NextResponse.json({ error: "Invalid or expired upload link" }, { status: 404 });
  }

  const expiresAt = new Date(intakeToken.expires_at as string);
  if (expiresAt < new Date()) {
    return NextResponse.json({ error: "This upload link has expired" }, { status: 410 });
  }

  // ── Insert the upload ─────────────────────────────────────────────────────
  const { error: insertError } = await supabase
    .from("zentra_intake_uploads")
    .insert({
      token_id:        intakeToken.id,
      account_id:      intakeToken.account_id,
      client_id:       intakeToken.client_id,
      upload_type:     uploadType,
      file_name:       fileName,
      file_size_bytes: fileSizeBytes ?? null,
      raw_content:     rawContent,
    });

  if (insertError) {
    console.error("[intake/upload] insert failed:", insertError);
    return NextResponse.json({ error: "Could not save file. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
