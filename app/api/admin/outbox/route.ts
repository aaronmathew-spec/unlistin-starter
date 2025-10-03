/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/auth";
import { beat } from "@/lib/ops/heartbeat";
import { dayStartUtc, safeHeadCount } from "@/lib/ops/metrics";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/**
 * Admin: quick rollup of the email outbox queue.
 * Table expected: outbox_emails(id, action_id, broker, subject_hash, body_present, status, created_at, updated_at)
 */
export async function GET() {
  try {
    await beat("admin.outbox:get");

    if (!(await isAdmin())) {
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const db = supa();
    const todayIso = dayStartUtc().toISOString();

    // Counts by status (all-time)
    const statuses = ["queued", "sending", "sent", "failed"] as const;
    const byStatus: Record<string, number> = {};
    for (const s of statuses) {
      byStatus[s] = await safeHeadCount(
        db.from("outbox_emails").select("*", { head: true, count: "exact" }).eq("status", s as any)
      );
    }

    // Today activity
    const todayQueued = await safeHeadCount(
      db.from("outbox_emails").select("*", { head: true, count: "exact" }).gte("created_at", todayIso)
    );
    const todaySent = await safeHeadCount(
      db.from("outbox_emails").select("*", { head: true, count: "exact" }).eq("status", "sent" as any).gte("updated_at", todayIso)
    );

    return NextResponse.json({
      ok: true,
      by_status: byStatus,
      today: { queued: todayQueued, sent: todaySent },
    });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "unexpected-error" }, { status: 500 });
  }
}
