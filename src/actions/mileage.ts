"use server";

/**
 * src/actions/mileage.ts
 *
 * Server-side CRUD for mileage trips. Persists to zentra_mileage_trips
 * when Supabase is configured; falls back to the localStorage layer in
 * src/lib/mileage.ts when not (demo / unauthenticated flows).
 *
 * The pure HMRC AMAP calc lives in lib/mileage.ts and is reused on both
 * client and server — server actions only handle storage.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface MileageTripRecord {
  id:        string;
  date:      string;   // YYYY-MM-DD
  miles:     number;
  purpose:   string;
  fromTo?:   string;
  createdAt: string;
}

export interface AddMileageInput {
  date:    string;
  miles:   number;
  purpose: string;
  fromTo?: string;
  /** Local client id (e.g. trip-XXXX) — enables idempotent re-sync. */
  clientUuid?: string;
}

function isConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

async function resolveAccountId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member } = await supabase
    .from("zentra_account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (member?.account_id as string | undefined) ?? null;
}

export async function addMileage(input: AddMileageInput): Promise<{ ok: boolean; trip?: MileageTripRecord; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, error: "Not authenticated" };

    const row = {
      account_id:  accountId,
      trip_date:   input.date,
      miles:       input.miles,
      purpose:     input.purpose,
      from_to:     input.fromTo ?? null,
      client_uuid: input.clientUuid ?? null,
    };
    const query = input.clientUuid
      ? supabase.from("zentra_mileage_trips").upsert(row, { onConflict: "account_id,client_uuid" })
      : supabase.from("zentra_mileage_trips").insert(row);
    const { data, error } = await query
      .select("id, trip_date, miles, purpose, from_to, created_at")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "insert failed" };
    return {
      ok: true,
      trip: {
        id:        data.id,
        date:      data.trip_date,
        miles:     Number(data.miles),
        purpose:   data.purpose,
        fromTo:    data.from_to ?? undefined,
        createdAt: data.created_at,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function deleteMileage(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("zentra_mileage_trips").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function getMileageTrips(): Promise<MileageTripRecord[]> {
  if (!isConfigured()) return [];
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return [];

    const { data, error } = await supabase
      .from("zentra_mileage_trips")
      .select("id, trip_date, miles, purpose, from_to, created_at")
      .eq("account_id", accountId)
      .order("trip_date", { ascending: false });

    if (error || !data) return [];
    return data.map((r) => ({
      id:        r.id,
      date:      r.trip_date,
      miles:     Number(r.miles),
      purpose:   r.purpose,
      fromTo:    r.from_to ?? undefined,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Bulk insert used by the localStorage→Supabase migration helper.
 * Idempotent: trips with a clientUuid that already exists for the
 * account are skipped via upsert + ignoreDuplicates, so calling this
 * after every page mount cannot duplicate rows.
 */
export async function bulkImportMileage(trips: AddMileageInput[]): Promise<{ ok: boolean; inserted: number; error?: string }> {
  if (!isConfigured()) return { ok: true, inserted: 0 };
  if (!trips.length) return { ok: true, inserted: 0 };
  try {
    const supabase = await createSupabaseServerClient();
    const accountId = await resolveAccountId();
    if (!accountId) return { ok: false, inserted: 0, error: "Not authenticated" };

    const rows = trips.map((t) => ({
      account_id:  accountId,
      trip_date:   t.date,
      miles:       t.miles,
      purpose:     t.purpose,
      from_to:     t.fromTo ?? null,
      client_uuid: t.clientUuid ?? null,
    }));
    const { data, error } = await supabase
      .from("zentra_mileage_trips")
      .upsert(rows, { onConflict: "account_id,client_uuid", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, inserted: 0, error: error.message };
    return { ok: true, inserted: data?.length ?? 0 };
  } catch (err) {
    return { ok: false, inserted: 0, error: err instanceof Error ? err.message : "unknown" };
  }
}
