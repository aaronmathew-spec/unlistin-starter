/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAdmin, getSessionUser } from "@/lib/auth";
import { beat } from "@/lib/ops/heartbeat";

// Minimal JSON helper
function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

// Supabase server client (cookie-bound)
function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function GET() {
  try {
    // Heartbeat (topic is free-form now)
    await beat("admin.overview:get");

    // Admin gate
    if (!(await isAdmin())) {
      return json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const db = supa();
    const user = await getSessionUser();

    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // Accept the Supabase builder (not typed as a Promise) and await it inside.
    async function safeCount(q: any): Promise<number> {
      const { count, error } = await q;
      if (error) return 0;
      return count ?? 0;
    }

    // Prepared in last 24h
    const prepared24h = await safeCount(
      db
        .from("actions")
        .select("*", { head: true, count: "exact" })
        .eq("status", "prepared")
        .gte("created_at", since24h)
    );

    // Auto-submit ready = prepared + email channel (default to email if null)
    const autoSubmitReady = await safeCount(
      db
        .from("actions")
        .select("*", { head: true, count: "exact" })
        .eq("status", "prepared")
        .or("reply_channel.is.null,reply_channel.eq.email")
    );

    // Follow-ups due (simple heuristic): status='sent' and updated_at older than 24h
    const followupsDue = await safeCount(
      db
        .from("actions")
        .select("*", { head: true, count: "exact" })
        .eq("status", "sent")
        .lt("updated_at", since24h)
    );

    const payload = {
      ok: true,
      user: { id: user?.id || null, email: user?.email || null },
      metrics: {
        prepared24h,
        autoSubmitReady,
        followupsDue,
      },
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "unexpected-error" }, { status: 500 });
  }
}
