// lib/auth/rbac.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type AdminCheck = { ok: boolean; reason?: string };

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/** Returns ok:true if the current user has a role_binding of admin/owner. */
export async function isAdmin(): Promise<AdminCheck> {
  try {
    const db = supa();

    // If table doesn't exist yet, query will error; catch and return ok:false
    const { data, error } = await db
      .from("role_bindings")
      .select("role")
      .in("role", ["owner", "admin"])
      .limit(1);

    if (error) return { ok: false, reason: error.message };
    if (!data || data.length === 0) return { ok: false, reason: "not_admin" };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "unknown" };
  }
}
