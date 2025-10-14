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
 * Reads the current session user (server-side) using @supabase/ssr.
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
        // Next.js server components require revalidation to set cookies
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
 * Returns the list of admin emails from env (lowercased & trimmed).
 * Example env:
 *   ADMIN_EMAILS=you@company.com, admin2@company.com
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True if the provided email is in ADMIN_EMAILS.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminList = getAdminEmails();
  return adminList.includes(email.toLowerCase());
}

/**
 * Ensures the current session user is an admin.
 * Throws on Unauthorized / Forbidden so API routes can catch and return 401/403.
 * Returns the SessionUser on success.
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
