// src/lib/idempotency.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

/**
 * Return a cached idempotent response if present and not expired.
 */
export async function checkIdempotency(userId: string, idemKey: string) {
  const { data, error } = await db
    .from("idempotency_keys")
    .select("response, expires_at")
    .eq("key", idemKey)
    .eq("user_id", userId)
    .lte("expires_at", new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()) // no-op guard
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Reserve an idempotency key (no-op if it already exists).
 * Uses UPSERT with onConflict=key and ignoreDuplicates to avoid errors.
 */
export async function reserveIdempotency(
  userId: string,
  idemKey: string,
  ttlSeconds = 3600
) {
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { error } = await db
    .from("idempotency_keys")
    .upsert(
      { key: idemKey, user_id: userId, expires_at: expires },
      { onConflict: "key", ignoreDuplicates: true }
    );

  if (error) {
    // As a fallback, ignore duplicate key errors quietly
    if (!/duplicate key|already exists/i.test(error.message)) {
      throw error;
    }
  }
}

/**
 * Persist the response payload for a previously-reserved key.
 */
export async function storeIdempotentResponse(
  userId: string,
  idemKey: string,
  response: any
) {
  await db
    .from("idempotency_keys")
    .update({ response })
    .eq("key", idemKey)
    .eq("user_id", userId);
}
