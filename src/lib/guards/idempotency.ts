// src/lib/guards/idempotency.ts
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SR  = process.env.SUPABASE_SERVICE_ROLE!;

export async function ensureIdempotent(key: string, note?: string): Promise<"ok" | "exists"> {
  const sb = createClient(URL, SR, { auth: { persistSession: false } });
  const { error } = await sb.from("idempotency_keys").insert({ key, note }).select().single();
  if (!error) return "ok";
  // unique violation -> already processed
  if (String(error.message).toLowerCase().includes("duplicate")) return "exists";
  // Non-duplicate error: treat as exists to avoid double-processing
  return "exists";
}
