// lib/ops/metrics.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Small time helpers & a safe count wrapper for Postgrest `head:true` queries.
 * Keeps typing permissive to avoid friction across supabase-js minor versions.
 */

export function dayStartUtc(d = new Date()): Date {
  const t = new Date(d);
  t.setUTCHours(0, 0, 0, 0);
  return t;
}

export function sinceHoursAgoIso(hours: number): string {
  const ms = Math.max(0, Math.floor(hours)) * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

/**
 * Expects a built Postgrest query with `.select('*', { head:true, count:'exact' })`.
 * Returns `0` on any error or missing `count`.
 */
export async function safeHeadCount(q: any): Promise<number> {
  try {
    const { count, error } = await q;
    if (error) return 0;
    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
}
