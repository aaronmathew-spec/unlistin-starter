// src/app/api/ops/webforms/summary/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use anon + RLS. Auth session is read via getServerSupabase() below.
const db = createClient(url, anon, { auth: { persistSession: false } });

export async function GET(_req: NextRequest) {
  try {
    // Require a signed-in user (cookie-based session)
    const supa = getServerSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Try DB-side rollup first; if it isn't installed, fall back to client-side counts.
    let statsData: any = null;
    try {
      const statsRes = await db.rpc("webform_stats_rollup").maybeSingle();
      if (!statsRes.error) {
        statsData = statsRes.data ?? null;
      }
    } catch {
      // ignore; we'll compute fallback below
    }

    // Recent jobs (scoped by RLS)
    const recentRes = await db
      .from("webform_jobs")
      .select(
        "id, action_id, subject_id, url, status, attempt, scheduled_at, run_at, completed_at, result"
      )
      .order("created_at", { ascending: false })
      .limit(25);

    if (recentRes.error) {
      throw new Error(`[ops/webforms/summary] recent query failed: ${recentRes.error.message}`);
    }

    // Fallback counts if no stats function result
    let fallbackCounts = { queued: 0, running: 0, succeeded: 0, failed: 0 };
    if (!statsData) {
      const countsRes = await db
        .from("webform_jobs")
        .select("status", { count: "exact", head: false })
        .order("status", { ascending: true });

      if (!countsRes.error && Array.isArray(countsRes.data)) {
        const agg = { queued: 0, running: 0, succeeded: 0, failed: 0 };
        for (const row of countsRes.data as Array<{ status: string }>) {
          switch (row.status) {
            case "queued":
              agg.queued++;
              break;
            case "running":
              agg.running++;
              break;
            case "succeeded":
              agg.succeeded++;
              break;
            case "failed":
              agg.failed++;
              break;
            default:
              // ignore any unexpected statuses
              break;
          }
        }
        fallbackCounts = agg;
      }
    }

    return NextResponse.json({
      ok: true,
      stats: statsData ?? fallbackCounts,
      recent: recentRes.data ?? [],
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[ops/webforms/summary] error:", e?.message || e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
