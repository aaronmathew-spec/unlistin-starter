// app/api/ops/webform/bulk/retry-breached/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type Targets = { [k: string]: number } & { "*": number };
const TARGET_MINUTES: Targets = {
  truecaller: 60,
  naukri: 180,
  olx: 120,
  foundit: 180,
  shine: 180,
  timesjobs: 180,
  "*": 240,
};
const targetFor = (key: string) => TARGET_MINUTES[key] ?? TARGET_MINUTES["*"];

/**
 * POST /api/ops/webform/bulk/retry-breached
 * Body: { limit?: number }  // optional safety limit, default 200
 *
 * Effect:
 *   - finds jobs with status in ["queued","running","failed"] older than target
 *   - sets them back to "queued" and clears last_error
 */
export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = Math.max(1, Math.min(1000, body?.limit ?? 200));

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const { data, error } = await sb
    .from("webform_jobs")
    .select("id, created_at, controller_key, status")
    .in("status", ["queued", "running", "failed"])
    .order("created_at", { ascending: true })
    .limit(2000); // fetch a wider set, we’ll filter

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const breached = (data || []).filter((j) => {
    const key = (j.controller_key || "*") as string;
    const ageMs = now - new Date(j.created_at as string).getTime();
    return ageMs > targetFor(key) * 60 * 1000;
  });

  const pick = breached.slice(0, limit);
  if (!pick.length) {
    return NextResponse.json({ ok: true, updated: 0, totalBreached: breached.length });
  }

  // Update in chunks for safety
  const chunkSize = 100;
  let updated = 0;
  for (let i = 0; i < pick.length; i += chunkSize) {
    const chunk = pick.slice(i, i + chunkSize);
    const ids = chunk.map((r) => r.id as string);
    const { error: updErr } = await sb
      .from("webform_jobs")
      .update({ status: "queued", last_error: null })
      .in("id", ids);
    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message, updated }, { status: 500 });
    }
    updated += ids.length;
  }

  return NextResponse.json({ ok: true, updated, totalBreached: breached.length });
}
