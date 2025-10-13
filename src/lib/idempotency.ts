import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

export async function checkIdempotency(userId: string, idemKey: string) {
  const { data } = await db
    .from("idempotency_keys")
    .select("response, expires_at")
    .eq("key", idemKey)
    .eq("user_id", userId)
    .single();
  return data || null;
}

export async function reserveIdempotency(userId: string, idemKey: string, ttlSeconds = 3600) {
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db.from("idempotency_keys").insert({ key: idemKey, user_id: userId, expires_at: expires }).onConflict("key").ignore();
}

export async function storeIdempotentResponse(userId: string, idemKey: string, response: any) {
  await db.from("idempotency_keys").update({ response }).eq("key", idemKey).eq("user_id", userId);
}
