// src/lib/auth.ts
import { getServerSupabase } from "@/lib/supabaseServer";

export async function getCurrentUser() {
  const supa = getServerSupabase();
  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

export function isAdmin(user: { email?: string | null; app_metadata?: any } | null) {
  if (!user) return false;
  if (user.app_metadata?.role === "admin") return true;
  const allowed = (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return user.email ? allowed.includes(user.email.toLowerCase()) : false;
}
