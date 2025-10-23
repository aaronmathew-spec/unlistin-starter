// src/lib/ops/dlq.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("supabase_env_missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

/** Row shape we’ll store in the ops_dlq table */
export type DLQRow = {
  id: string;
  created_at: string;
  channel: "webform" | "email" | "api" | string;
  controller_key: string | null;
  subject_id: string | null;
  payload: any | null;      // JSON payload (potentially redacted)
  error_code: string | null;
  error_note: string | null;
  retries: number | null;
  meta?: any | null;
};

/** Insert a DLQ record (used across the codebase) */
export async function pushDLQ(input: {
  channel: DLQRow["channel"];
  controller_key: string | null;
  subject_id: string | null;
  payload: any | null;
  error_code: string | null;
  error_note: string | null;
  retries?: number | null;
  meta?: any | null;
}) {
  const client = sb();
  const { error } = await client.from("ops_dlq").insert({
    channel: input.channel,
    controller_key: input.controller_key ?? null,
    subject_id: input.subject_id ?? null,
    payload: input.payload ?? null,
    error_code: input.error_code ?? null,
    error_note: input.error_note ?? null,
    retries: input.retries ?? 0,
    meta: input.meta ?? null,
  });
  if (error) throw error;
  return { ok: true as const };
}

/** Fetch latest DLQ items for Ops UI */
export async function listDLQ(limit = 200): Promise<DLQRow[]> {
  const client = sb();
  const { data, error } = await client
    .from("ops_dlq")
    .select("id, created_at, channel, controller_key, subject_id, payload, error_code, error_note, retries, meta")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(1000, limit)));
  if (error) throw error;
  return (data || []) as DLQRow[];
}

/**
 * Retry stub – returns a friendly message.
 * You can later requeue to your worker here based on row.channel/payload.
 */
export async function retryDLQ(id: string) {
  const client = sb();
  const { data, error } = await client
    .from("ops_dlq")
    .select("id, channel, controller_key, payload, retries")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false as const, error: "not_found" };

  // TODO: Implement a real re-enqueue based on channel/payload:
  // e.g., if (data.channel === "webform") await enqueueWebformJob(data.payload)
  // For now, we only bump retries to signal the attempt.
  const { error: upErr } = await client
    .from("ops_dlq")
    .update({ retries: (data.retries ?? 0) + 1 })
    .eq("id", id);
  if (upErr) throw upErr;

  return { ok: true as const, note: "retry_recorded" };
}
