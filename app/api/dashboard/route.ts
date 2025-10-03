/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Customer dashboard data (current user only; RLS enforced).
 * Returns only redacted/aggregated fields.
 */
function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function GET() {
  const db = supa();

  // Totals by status (RLS should scope to current user/workspace)
  const statuses = ["prepared", "sent", "completed", "needs_user"] as const;

  async function countByStatus(status: string) {
    const { count, error } = await db.from("actions").select("*", { count: "exact", head: true }).eq("status", status);
    if (error) return 0;
    return count ?? 0;
  }

  // Basic KPIs
  const [prepared, sent, completed, needsUser] = await Promise.all(
    statuses.map((s) => countByStatus(s))
  );

  // Exposure = prepared + sent + completed (rough proxy for items detected)
  const exposure = prepared + sent + completed;

  // 14-day trend for prepared & completed
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent, error: recentErr } = await db
    .from("actions")
    .select("id, status, inserted_at")
    .gte("inserted_at", since)
    .order("inserted_at", { ascending: true });

  const daily = new Map<string, { date: string; prepared: number; completed: number }>();
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
    daily.set(key, { date: key, prepared: 0, completed: 0 });
  }
  if (!recentErr && Array.isArray(recent)) {
    for (const r of recent) {
      const key = new Date(r.inserted_at).toISOString().slice(0, 10);
      const row = daily.get(key);
      if (row) {
        if (r.status === "prepared") row.prepared++;
        if (r.status === "completed") row.completed++;
      }
    }
  }
  const trend = days.map((d) => daily.get(d)!);

  // Items needing user input (top 5, redacted)
  const { data: needList } = await db
    .from("actions")
    .select("id, broker, category, redacted_identity, inserted_at")
    .eq("status", "needs_user")
    .order("inserted_at", { ascending: false })
    .limit(5);

  // Recent activity (last 8 events, redacted)
  const { data: recentList } = await db
    .from("actions")
    .select("id, broker, category, status, inserted_at")
    .order("inserted_at", { ascending: false })
    .limit(8);

  return NextResponse.json({
    ok: true,
    kpis: {
      exposure,
      prepared,
      sent,
      completed,
      needsUser,
    },
    trend,
    needs: (needList || []).map((a: any) => ({
      id: a.id,
      broker: a.broker || "Unknown",
      category: a.category || "directory",
      since: a.inserted_at,
      redacted: a.redacted_identity || {},
    })),
    recent: (recentList || []).map((a: any) => ({
      id: a.id,
      broker: a.broker || "Unknown",
      category: a.category || "directory",
      status: a.status,
      at: a.inserted_at,
    })),
  });
}
