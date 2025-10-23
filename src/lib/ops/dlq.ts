// src/lib/ops/dlq.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

/**
 * Table (SQL you should have/migrate):
 * create table if not exists dlq_events (
 *   id bigserial primary key,
 *   channel text not null,                 -- 'webform' | 'email' | ...
 *   controller_key text,
 *   subject_id text,
 *   payload jsonb,
 *   error_code text,
 *   error_note text,
 *   retries int default 0,
 *   created_at timestamptz default now()
 * );
 * create index if not exists idx_dlq_created on dlq_events(created_at desc);
 */

export async function pushDLQ(evt: {
  channel: string;
  controller_key?: string | null;
  subject_id?: string | null;
  payload?: unknown;
  error_code?: string | null;
  error_note?: string | null;
  retries?: number | null;
}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  await sb.from("dlq_events").insert({
    channel: evt.channel,
    controller_key: evt.controller_key ?? null,
    subject_id: evt.subject_id ?? null,
    payload: evt.payload ?? null,
    error_code: evt.error_code ?? null,
    error_note: evt.error_note ?? null,
    retries: evt.retries ?? 0,
  });
}
