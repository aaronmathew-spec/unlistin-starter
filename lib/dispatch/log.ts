// lib/dispatch/log.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type DispatchAudit = {
  dedupeKey: string;
  controllerKey: string;
  subject: { name?: string | null; email?: string | null; phone?: string | null };
  locale: "en" | "hi";
  channel?: "email" | "webform" | "api" | null;
  ok: boolean;
  error?: string | null;
  providerId?: string | null;
  note?: string | null;
};

export async function ensureDispatchTables(): Promise<void> {
  // Best-effort: if table/policy already exist, this no-ops (thanks to IF NOT EXISTS)
  // Runs only under service role.
  const ddl = `
  create table if not exists public.dispatch_log (
    id bigserial primary key,
    dedupe_key text not null,
    controller_key text not null,
    subject_email text,
    subject_phone text,
    subject_name text,
    locale text not null,
    channel text,
    provider_id text,
    note text,
    ok boolean not null default false,
    error text,
    created_at timestamp with time zone not null default now()
  );

  create index if not exists idx_dispatch_log_dedupe on public.dispatch_log (dedupe_key);
  create index if not exists idx_dispatch_log_created on public.dispatch_log (created_at desc);
  `;
  try {
    const supa = adminSupabase();
    await supa.rpc("exec_sql", { sql: ddl } as any);
  } catch {
    // If no "exec_sql" function exists in your instance, ignore silently;
    // we rely on earlier migrations having created the table.
  }
}

export async function insertDispatch(a: DispatchAudit) {
  try {
    const supa = adminSupabase();
    const { error } = await supa.from("dispatch_log").insert({
      dedupe_key: a.dedupeKey,
      controller_key: a.controllerKey,
      subject_email: a.subject.email || null,
      subject_phone: a.subject.phone || null,
      subject_name: a.subject.name || null,
      locale: a.locale,
      channel: a.channel || null,
      provider_id: a.providerId || null,
      note: a.note || null,
      ok: a.ok,
      error: a.error || null,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[dispatch_log.insert.error]", error.message);
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn("[dispatch_log.insert.exception]", e?.message || e);
  }
}

/** Returns the most recent success that matches dedupeKey within lookback minutes. */
export async function findRecentSuccess(
  dedupeKey: string,
  lookbackMinutes = 24 * 60,
): Promise<{ id: number; created_at: string } | null> {
  try {
    const since = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();
    const supa = adminSupabase();
    const { data, error } = await supa
      .from("dispatch_log")
      .select("id, created_at, ok")
      .eq("dedupe_key", dedupeKey)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("[dispatch_log.query.error]", error.message);
      return null;
    }
    const row = (data ?? [])[0] as { id: number; created_at: string; ok: boolean } | undefined;
    if (row && row.ok === true) return { id: row.id, created_at: row.created_at };
    return null;
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn("[dispatch_log.query.exception]", e?.message || e);
    return null;
  }
}
