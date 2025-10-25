// src/lib/authz/footer.ts
import { createClient } from "@supabase/supabase-js";

type AuthorizationRow = {
  id: string;
  signed_at: string;
  manifest_hash: string | null;
};

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Build a short, human-readable footer that proves we have signed authority.
 * Safe to append to plaintext email bodies.
 *
 * Usage:
 *   const footer = await authorizationFooter(authorizationId);
 *   const body = `${mainBody}\n${footer}`;
 */
export async function authorizationFooter(authorizationId?: string | null): Promise<string> {
  if (!authorizationId) return "";

  try {
    const supa = admin();
    const { data, error } = await supa
      .from("authorizations")
      .select("id, signed_at, manifest_hash")
      .eq("id", authorizationId)
      .maybeSingle<AuthorizationRow>();

    if (error || !data) return "";

    const hash = (data.manifest_hash ?? "").slice(0, 12);
    const when = new Date(data.signed_at).toISOString();

    return [
      "",
      "--",
      "Authorization:",
      `  ID: ${data.id}`,
      `  Signed: ${when}`,
      `  Hash: ${hash}`,
    ].join("\n");
  } catch {
    return "";
  }
}
