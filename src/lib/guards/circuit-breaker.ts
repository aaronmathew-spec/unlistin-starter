// src/lib/guards/circuit-breaker.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

/**
 * Table (SQL you should have/migrate):
 * create table if not exists controller_failures (
 *   id bigserial primary key,
 *   controller_key text not null,
 *   error_code text,
 *   error_note text,
 *   created_at timestamptz default now()
 * );
 * create index if not exists idx_ctrl_fail_key_created on controller_failures(controller_key, created_at desc);
 */

export async function recordControllerFailure(
  controllerKey: string,
  errorCode: string,
  errorNote?: string
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  await sb.from("controller_failures").insert({
    controller_key: controllerKey,
    error_code: errorCode,
    error_note: errorNote ?? null,
  });
}

export async function shouldAllowController(
  controllerKey: string,
  windowMinutes = 15,
  threshold = 5
): Promise<{ allow: boolean; recentFailures: number }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return { allow: true, recentFailures: 0 };
  const sinceISO = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("controller_failures")
    .select("id", { count: "exact", head: true })
    .eq("controller_key", controllerKey)
    .gte("created_at", sinceISO);
  const count = (data as any)?.length ?? (error ? 0 : 0); // head:true won't include rows; rely on count below
  const exact =
    // @ts-ignore supabase-js returns count on the response object
    typeof (data as any)?.count === "number" ? (data as any).count : (count || 0);
  return { allow: exact < threshold, recentFailures: exact };
}
