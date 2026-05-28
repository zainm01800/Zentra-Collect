/**
 * src/app/intake/[token]/page.tsx
 *
 * Public intake page — no authentication required.
 * A client follows the link their bookkeeper shared and uploads their
 * invoice CSV and/or bank statement CSV.
 *
 * The token is validated server-side; expired or invalid tokens show an
 * error state. Files are stored in the zentra_intake_uploads table and
 * visible to the bookkeeper in their portfolio view.
 */

import { createClient } from "@supabase/supabase-js";
import { IntakeUploadClient } from "./intake-upload-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function IntakePage({ params }: PageProps) {
  const { token } = await params;

  // ── Validate the token using the anon key (public access) ──────────────────
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return <ErrorState message="This service is temporarily unavailable." />;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: intake, error } = await supabase
    .from("zentra_intake_tokens")
    .select("id, client_id, client_name, bookkeeper_name, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !intake) {
    return (
      <ErrorState message="This upload link is invalid or has expired. Please ask your bookkeeper for a new one." />
    );
  }

  const expiresAt = new Date(intake.expires_at as string);
  if (expiresAt < new Date()) {
    return (
      <ErrorState message="This upload link has expired. Please ask your bookkeeper for a new link." />
    );
  }

  return (
    <IntakeUploadClient
      token={token}
      tokenId={intake.id as string}
      clientName={intake.client_name as string}
      clientId={intake.client_id as string}
      bookkeeperName={(intake.bookkeeper_name as string | null) ?? "Your bookkeeper"}
      expiresAt={expiresAt.toISOString()}
    />
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#faf9f7" }}>
      <div className="max-w-sm text-center">
        <div
          className="size-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "#f0ede8" }}
        >
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-[17px] font-semibold text-[#1d1813] mb-2">Link unavailable</h1>
        <p className="text-[13.5px] text-[#6b6253]">{message}</p>
      </div>
    </div>
  );
}
