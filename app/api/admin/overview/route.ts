/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Admin overview: adapter-level stats, caps/kills, and recent actions.
 * RLS should restrict to admin; ensure your RLS/policies enforce this.
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

  // Totals by status (across tenants; make sure admin-only)
  const statuses = ["prepared", "sent", "completed", "needs_user", "failed"] as const;
  async function countByStatus(status: string) {
    const { count } = await db.from("actions").select("*", { count: "exact", head: true }).eq("status", status);
    return count ?? 0;
  }
  const totals: Record<string, number> = {};
  for (const s of statuses) totals[s] = await countByStatus(s);

  // Adapter table (last 14 days)
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await db
    .from("actions")
    .select("adapter, status")
    .gte("inserted_at", since);

  const perAdapter = new Map<string, { adapter: string; prepared: number; sent: number; completed: number; failed: number }>();
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const k = (r.adapter || "generic") as string;
      if (!perAdapter.has(k)) perAdapter.set(k, { adapter: k, prepared: 0, sent: 0, completed: 0, failed: 0 });
      const row = perAdapter.get(k)!;
      if (r.status === "prepared") row.prepared++;
      else if (r.status === "sent") row.sent++;
      else if (r.status === "completed") row.completed++;
      else if (r.status === "failed") row.failed++;
    }
  }

  // Adapter controls snapshot (caps/kills)
  const { data: controls } = await db.from("adapter_controls").select("adapter, killed, daily_cap_prepare, daily_cap_sent, min_confidence");

  // Recent actions (20)
  const { data: recent } = await db
    .from("actions")
    .select("id, adapter, broker, category, status, confidence, inserted_at")
    .order("inserted_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    ok: true,
    totals,
    adapters: Array.from(perAdapter.values()),
    controls: (controls || []).map((c: any) => ({
      adapter: c.adapter,
      killed: !!c.killed,
      cap_prepare: c.daily_cap_prepare ?? null,
      cap_sent: c.daily_cap_sent ?? null,
      min_conf: c.min_confidence ?? null,
    })),
    recent: (recent || []).map((a: any) => ({
      id: a.id,
      adapter: a.adapter || "generic",
      broker: a.broker || "Unknown",
      category: a.category || "directory",
      status: a.status,
      confidence: typeof a.confidence === "number" ? a.confidence : null,
      at: a.inserted_at,
    })),
  });
}
