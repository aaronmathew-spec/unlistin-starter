// src/lib/guards/idempotency.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR  = process.env.SUPABASE_SERVICE_ROLE!;

/**
 * Try to store a unique idempotency key.
 * - "ok"     -> first time; proceed
 * - "exists" -> duplicate; return a deduped success
 */
export async function ensureIdempotent(key: string, note?: string): Promise<"ok" | "exists"> {
  const sb = createClient(URL, SR, { auth: { persistSession: false } });
  const { error } = await sb.from("idempotency_keys").insert({ key, note }).select().single();
  if (!error) return "ok";
  const msg = String(error.message || "").toLowerCase();
  if (msg.includes("duplicate") || msg.includes("unique")) return "exists";
  // Be conservative on unexpected insert errors to avoid double-processing.
  return "exists";
}
