/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { beat } from "@/lib/ops/heartbeat";
import { assertAdmin, getSessionUser } from "@/lib/auth";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * GET /api/admin/overview
 * Returns high-level metrics for the admin dashboard.
 * All numbers are aggregate-only; no PII.
 */
export async function GET() {
  try {
    await beat("admin.overview:get");
    await assertAdmin();

    const db = supa();
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // Helpers so we never throw if a column/table is different than expected.
    async function safeCount(q: any): Promise<number> {
      try {
        const { count, error } = await q.select("id", { count: "exact", head: true });
        if (error) return 0;
        return count ?? 0;
      } catch {
        return 0;
      }
    }

    // Prepared in last 24h
    const prepared24h = await safeCount(
      db.from("actions").eq("status", "prepared").gte("created_at", since24h)
    );

    // Ready to auto-submit (prepared + email channel). If reply_channel missing, treat as email by default.
    const autoSubmitReady = await safeCount(
      db
        .from("actions")
        .eq("status", "prepared")
        .or("reply_channel.eq.email,reply_channel.is.null")
    );

    // Follow-ups due today (unscheduled)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dueSince = startOfDay.toISOString();
    const followupsDueToday = await safeCount(
      db.from("followups").eq("scheduled", false).gte("due_at", dueSince)
    );

    // A rough proxy of “users with automation enabled”. If your schema has a better signal,
    // replace this with that. Here we count distinct users with any action row.
    let automationUsers = 0;
    try {
      const { data, error } = await db
        .from("actions")
        .select("user_id", { count: "exact", head: true });
      if (!error) automationUsers = (data as any)?.length ?? 0; // count is unreliable in head mode on some clients
    } catch {
      automationUsers = 0;
    }

    const user = await getSessionUser();

    return json({
      ok: true,
      actor: { id: user?.id || null, email: user?.email || null },
      metrics: {
        prepared_24h: prepared24h,
        auto_submit_ready: autoSubmitReady,
        followups_due_today: followupsDueToday,
        automation_users: automationUsers,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
