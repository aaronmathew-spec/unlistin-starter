// lib/dispatch/query.ts
import { createClient } from "@supabase/supabase-js";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type DispatchLogRow = {
  id: number;
  dedupe_key: string;
  controller_key: string;
  subject_email: string | null;
  subject_phone: string | null;
  subject_name: string | null;
  locale: "en" | "hi";
  channel: string | null;
  provider_id: string | null;
  note: string | null;
  ok: boolean;
  error: string | null;
  created_at: string;
};

export async function listDispatchLog(limit = 100): Promise<DispatchLogRow[]> {
  const supa = adminSupabase();
  const { data, error } = await supa
    .from("dispatch_log")
    .select(
      "id, dedupe_key, controller_key, subject_email, subject_phone, subject_name, locale, channel, provider_id, note, ok, error, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(500, limit)));
  if (error) {
    console.warn("[dispatch_log.list.error]", error.message);
    return [];
  }
  return (data ?? []) as DispatchLogRow[];
}
