// src/app/api/v1/_auth.ts
import { createClient } from "@supabase/supabase-js";
import { hashPAT, parseBearer, publicPrefixFrom } from "@/lib/security/pat";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

export async function requirePAT(req: Request) {
  const token = parseBearer(req);
  if (!token) return { ok: false as const, error: "Missing Bearer token" };

  const prefix = publicPrefixFrom(token);

  const { data, error } = await db
    .from("api_keys")
    .select("id,user_id,hash,revoked_at,scopes")
    .eq("prefix", prefix)
    .limit(1)
    .single();

  if (error || !data) return { ok: false as const, error: "Invalid token" };
  if (data.revoked_at) return { ok: false as const, error: "Token revoked" };

  const hash = hashPAT(token);
  if (hash !== data.hash) return { ok: false as const, error: "Invalid token" };

  // Fire-and-forget: update last_used_at without blocking or TS issues
  (async () => {
    try {
      await db
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id);
    } catch {
      /* swallow */
    }
  })();

  return {
    ok: true as const,
    userId: data.user_id as string,
    scopes: (data.scopes || []) as string[],
  };
}
