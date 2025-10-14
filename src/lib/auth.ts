// src/lib/auth.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type SessionUser = {
  id: string;
  email: string | null;
};

/**
 * Server-side: get current session user via @supabase/ssr.
 * Returns null if unauthenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Admin list from env (lowercased & trimmed).
 * Example: ADMIN_EMAILS=you@company.com, admin2@company.com
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Is this email an admin? */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

/**
 * Async convenience used in pages/routes:
 * returns true if the current session user is an admin.
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return !!(user && isAdminEmail(user.email));
}

/**
 * Throwing guard for API routes: ensures current user is admin.
 * Throws "Unauthorized" or "Forbidden" (caller should map to 401/403).
 */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (!isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
  return user;
}
