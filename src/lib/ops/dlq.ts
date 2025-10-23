// src/lib/ops/dlq.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR  = process.env.SUPABASE_SERVICE_ROLE!;

export async function pushDLQ(input: {
  channel: "webform" | "email" | string;
  controller_key?: string | null;
  subject_id?: string | null;
  payload?: unknown;
  error_code?: string | null;
  error_note?: string | null;
  retries?: number;
}) {
  const sb = createClient(URL, SR, { auth: { persistSession: false } });
  await sb.from("dlq_jobs").insert({
    channel: input.channel,
    controller_key: input.controller_key ?? null,
    subject_id: input.subject_id ?? null,
    payload: input.payload ?? null,
    error_code: input.error_code ?? null,
    error_note: input.error_note ?? null,
    retries: input.retries ?? 0,
  });
}
