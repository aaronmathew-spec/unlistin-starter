// app/api/ops/webform/job/[id]/cancel/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

/**
 * POST /api/ops/webform/job/:id/cancel
 * Body: { reason?: string }
 *
 * Effect:
 *   - status -> "failed"
 *   - last_error -> reason || "cancelled by ops"
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return NextResponse.json({ ok: false, error: "env_missing" }, { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body?.reason || "cancelled by ops").toString();

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });

  const { data: row, error: findErr } = await sb
    .from("webform_jobs")
    .select("id,status")
    .eq("id", id)
    .single();
  if (findErr || !row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const { error: updErr } = await sb
    .from("webform_jobs")
    .update({ status: "failed", last_error: reason })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, prevStatus: row.status, newStatus: "failed", reason });
}
