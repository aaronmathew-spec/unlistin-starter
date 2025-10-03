/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { beat } from "@/lib/ops/heartbeat";
import { loadControlsMap } from "@/lib/auto/controls"; // read-only view of admin controls

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init?.headers || {}) },
  });
}

async function assertAdmin() {
  const ok = await isAdmin();
  if (!ok) throw Object.assign(new Error("Forbidden"), { status: 403 });
}

/**
 * GET /api/admin/adapter/controls
 * - Read current adapter controls (kill switches, caps, thresholds).
 * - This uses your existing read helper and avoids schema writes.
 */
export async function GET() {
  try {
    await beat("admin.adapter.controls:get");
    await assertAdmin();

    const controls = await loadControlsMap(); // { [adapterId]: { killed?: boolean, ... } }
    return NextResponse.json({ ok: true, controls });
  } catch (err: any) {
    const status = Number.isFinite(err?.status) ? err.status : 500;
    return json({ ok: false, error: err?.message || "Internal error" }, { status });
  }
}

/**
 * POST /api/admin/adapter/controls
 * - Kept as 405 to avoid coupling to a specific DB schema.
 * - If/when you add a Supabase table for controls, implement an upsert here.
 */
export async function POST() {
  try {
    await beat("admin.adapter.controls:post");
    await assertAdmin();
    return json({ ok: false, error: "Not implemented (read-only endpoint)" }, { status: 405 });
  } catch (err: any) {
    const status = Number.isFinite(err?.status) ? err.status : 500;
    return json({ ok: false, error: err?.message || "Internal error" }, { status });
  }
}
