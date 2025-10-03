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
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

export async function GET() {
  try {
    await beat("admin.overview:get");
    await assertAdmin();

    const db = supa();
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // today 00:00–23:59:59.999 (UTC; adjust if you store with tz)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);
    const todayStartIso = startOfDay.toISOString();
    const todayEndIso = endOfDay.toISOString();

    // Helper that returns a numeric count, never undefined
    async function exactCount(builder: any): Promise<number> {
      const { count, error } = await builder;
      if (error) return 0;
      return typeof count === "number" ? count : 0;
    }

    // Prepared in last 24h
    const prepared24h = await exactCount(
      db
        .from("actions")
        .select("id", { count: "exact", head: true })
        .eq("status", "prepared")
        .gte("created_at", since24h)
    );

    // Ready to auto-submit (prepared + email channel). If reply_channel is missing, treat as email.
    const autoSubmitReady = await exactCount(
      db
        .from("actions")
        .select("id", { count: "exact", head: true })
        .eq("status", "prepared")
        // reply_channel is NULL OR 'email'
        .or("reply_channel.is.null,reply_channel.eq.email")
    );

    // Follow-ups due today (unscheduled)
    const followupsDueToday = await exactCount(
      db
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("scheduled", false)
        .gte("due_at", todayStartIso)
        .lte("due_at", todayEndIso)
    );

    const user = await getSessionUser();

    return NextResponse.json({
      ok: true,
      user: { id: user?.id || null, email: user?.email || null },
      metrics: {
        prepared24h,
        autoSubmitReady,
        followupsDueToday,
      },
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "admin.overview failed" }, { status: 500 });
  }
}
