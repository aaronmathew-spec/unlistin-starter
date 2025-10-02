// lib/auth.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export type SessionUser = {
  id: string;
  email?: string | null;
};

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/**
 * Fetch minimal user identity (if signed in) via Supabase auth.
 * Works with RLS since we use the same cookie jar the app uses.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const db = supa();
  const { data, error } = await db.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Admin check:
 * 1) If the user has a row in user_roles with role='admin', they're admin.
 * 2) Optional fallback: if ADMIN_EMAILS env contains their email (comma list).
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;

  const db = supa();
  const { data } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (data?.role === "admin") return true;

  const allow = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (user.email && allow.includes(user.email.toLowerCase())) return true;

  return false;
}
