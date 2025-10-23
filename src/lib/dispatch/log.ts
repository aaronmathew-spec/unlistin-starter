// src/lib/dispatch/log.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import type { LocaleShort, SubjectProfile } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

/**
 * Table (SQL you should have/migrate):
 * create table if not exists dispatch_log (
 *   id bigserial primary key,
 *   dedupe_key text not null,
 *   controller_key text not null,
 *   subject jsonb,
 *   locale text,
 *   channel text,                -- 'api' | 'webform' | 'email'
 *   ok boolean,
 *   provider_id text,
 *   error text,
 *   note text,
 *   created_at timestamptz default now()
 * );
 * create index if not exists idx_dispatch_key_created on dispatch_log(dedupe_key, created_at desc);
 */

export function makeDedupeKey(input: {
  controllerKey: string;
  subject: SubjectProfile;
  locale: LocaleShort | null | undefined;
}) {
  const s = input.subject || {};
  const ident = (s.id || s.email || s.phone || s.handle || s.name || "anon") || "anon";
  const shortLocale = input.locale === "hi" ? "hi" : "en";
  return `${input.controllerKey}:${ident}:${shortLocale}`;
}

export async function wasRecentlyDispatched(
  dedupeKey: string,
  minutes = 24 * 60
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return false;
  const sinceISO = new Date(Date.now() - minutes * 60_000).toISOString();
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("dispatch_log")
    .select("id", { head: true, count: "exact" })
    .eq("dedupe_key", dedupeKey)
    .gte("created_at", sinceISO);

  // @ts-ignore supabase-js places count on response
  const cnt = (data as any)?.count ?? 0;
  return !error && cnt > 0;
}

export async function recordDispatch(entry: {
  dedupeKey: string;
  controllerKey: string;
  subject: SubjectProfile;
  locale: LocaleShort | null | undefined;
  channel: "api" | "webform" | "email";
  ok: boolean;
  providerId?: string | null;
  error?: string | null;
  note?: string | null;
}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  await sb.from("dispatch_log").insert({
    dedupe_key: entry.dedupeKey,
    controller_key: entry.controllerKey,
    subject: entry.subject ?? null,
    locale: entry.locale ?? null,
    channel: entry.channel,
    ok: entry.ok,
    provider_id: entry.providerId ?? null,
    error: entry.error ?? null,
    note: entry.note ?? null,
  });
}
