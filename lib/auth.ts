// lib/auth.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type SupaUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, any>;
};

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (k: string) => jar.get(k)?.value,
      },
    }
  );
}

/**
 * Returns the authenticated Supabase user or null.
 * Safe to call in server components and route handlers.
 */
export async function getSessionUser(): Promise<SupaUser | null> {
  try {
    const db = supa();
    const { data, error } = await db.auth.getUser();
    if (error || !data?.user) return null;
    const u = data.user as unknown as SupaUser;
    return u ?? null;
  } catch {
    return null;
  }
}

/**
 * Allow multiple ways to mark someone as admin:
 * - ADMIN_EMAILS: comma-separated list of exact emails
 * - ADMIN_EMAIL_DOMAIN: any user with this email domain
 * - user_metadata.role === 'admin'
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;

  const email = (user.email || "").toLowerCase().trim();

  // 1) Explicit email allowlist
  const rawList =
    process.env.ADMIN_EMAILS ??
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ??
    "";
  const allowlist = rawList
    .split(",")
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean);
  if (email && allowlist.includes(email)) return true;

  // 2) Domain allow (optional)
  const domain = (process.env.ADMIN_EMAIL_DOMAIN || "")
    .toLowerCase()
    .trim();
  if (email && domain && email.endsWith(`@${domain}`)) return true;

  // 3) Role in user metadata
  const role = String(user.user_metadata?.role || "").toLowerCase();
  if (role === "admin") return true;

  return false;
}

/**
 * Throws a 403-style Error if the current user is not an admin.
 * Your API routes can:
 *   await assertAdmin();
 * and optionally catch the error to return a 403 JSON.
 */
export async function assertAdmin(): Promise<void> {
  const ok = await isAdmin();
  if (!ok) {
    const err = new Error("forbidden: admin only");
    // attach a status code that route handlers may choose to read
    (err as any).status = 403;
    throw err;
  }
}
