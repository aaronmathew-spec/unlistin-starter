/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { beat } from "@/lib/ops/heartbeat";
import { getSessionUser, assertAdmin } from "@/lib/auth";

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

type CountBuilder =
  | ReturnType<ReturnType<typeof createServerClient>["from"]>;

async function safeCount(builder: CountBuilder) {
  // Supabase requires select("*", { count: "exact", head: true }) for a count-only.
  const { count, error } = await (builder as any)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * GET /api/admin/overview
 * Aggregate-only stats for admin dashboard cards. No PII.
 */
export async function GET() {
  try {
    await beat("admin.overview:get");
    await assertAdmin();

    const db = supa();
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // Prepared in last 24h
    const prepared24h = await safeCount(
      db.from("actions").eq("status", "prepared").gte("created_at", since24h)
    );

    // Auto-submit ready = prepared + email channel (default email if null)
    const readyEmail = await safeCount(
      db.from("actions")
        .eq("status", "prepared")
        .or("reply_channel.is.null,reply_channel.eq.email")
    );

    // Follow-ups due today (scheduled=false, due_at <= today 23:59:59)
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const followupsDue = await safeCount(
      db.from("followups")
        .eq("scheduled", false)
        .lte("due_at", endOfToday.toISOString())
    );

    // Automation enabled users (feature flag on profile)
    const enabledUsers = await safeCount(
      db.from("profiles").eq("automation_enabled", true)
    );

    const me = await getSessionUser();

    return NextResponse.json({
      ok: true,
      me: { id: me?.id, email: me?.email ?? null },
      metrics: {
        prepared24h,
        readyEmail,
        followupsDue,
        enabledUsers,
      },
    });
  } catch (err: any) {
    return json({ ok: false, error: err?.message ?? String(err) }, { status: 400 });
  }
}
