// src/app/api/ops/webforms/summary/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, anon, { auth: { persistSession: false } });

export async function GET(req: NextRequest) {
  try {
    // Require auth (session cookie)
    const supa = getServerSupabase();
    const {
      data: { user },
      error,
    } = await supa.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // RLS ensures we only see the caller's rows
    const [stats, recent] = await Promise.all([
      db.rpc("webform_stats_rollup").maybeSingle().catch(() => ({ data: null } as any)),
      db
        .from("webform_jobs")
        .select("id, action_id, subject_id, url, status, attempt, scheduled_at, run_at, completed_at, result")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    // If you don't want to create a Postgres function, compute basic counts here:
    let fallbackCounts = { queued: 0, running: 0, succeeded: 0, failed: 0 };
    if (!stats?.data) {
      const { data: c } = await db
        .from("webform_jobs")
        .select("status, count:id", { head: false, count: "exact" })
        .group("status");
      if (Array.isArray(c)) {
        fallbackCounts = {
          queued: c.find((x: any) => x.status === "queued")?.count || 0,
          running: c.find((x: any) => x.status === "running")?.count || 0,
          succeeded: c.find((x: any) => x.status === "succeeded")?.count || 0,
          failed: c.find((x: any) => x.status === "failed")?.count || 0,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      stats: stats?.data ?? fallbackCounts,
      recent: recent.data ?? [],
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[ops/webforms/summary] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
