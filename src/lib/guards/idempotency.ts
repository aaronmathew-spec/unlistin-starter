// src/lib/guards/idempotency.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

/**
 * Ensures a key is only used once in a TTL window (default 24h).
 * Creates row if not present, returns "created"; returns "exists" if already present.
 *
 * Table (SQL you should have/migrate):
 * create table if not exists idempotency_keys (
 *   key text primary key,
 *   scope text not null,
 *   created_at timestamptz default now()
 * );
 * create index if not exists idx_idem_created_at on idempotency_keys(created_at);
 */
export async function ensureIdempotent(
  key: string,
  scope: string,
  ttlHours = 24
): Promise<"created" | "exists" | "error"> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return "error";
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  // prune old keys (best effort, non-blocking)
  void sb
    .from("idempotency_keys")
    .delete()
    .lt("created_at", new Date(Date.now() - ttlHours * 3600_000).toISOString());

  const { error } = await sb.from("idempotency_keys").insert({ key, scope }).select().single();
  if (!error) return "created";
  if (String(error.message || "").toLowerCase().includes("duplicate")) return "exists";
  return "exists"; // safest default to avoid duplicates on transient errors
}
