// src/app/api/ops/webforms/[id]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, anon, { auth: { persistSession: false } });

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Require signed-in user
    const supa = getServerSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the job (RLS ensures ownership via subjects.user_id)
    const { data: jobs, error: jobErr } = await db
      .from("webform_jobs")
      .select(
        "id, action_id, subject_id, url, status, attempt, scheduled_at, run_at, completed_at, result, created_at, updated_at"
      )
      .eq("id", params.id)
      .limit(1);

    if (jobErr) {
      throw new Error(`[ops/webforms/:id] fetch failed: ${jobErr.message}`);
    }
    const job = jobs?.[0];
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch action context
    const { data: actionRows, error: actionErr } = await db
      .from("actions")
      .select(
        "id, status, controller_id, to, verification_info, created_at, updated_at"
      )
      .eq("id", job.action_id)
      .limit(1);

    if (actionErr) {
      throw new Error(`[ops/webforms/:id] action fetch failed: ${actionErr.message}`);
    }
    const action = actionRows?.[0] || null;

    // Optionally fetch controller context
    let controller: any = null;
    if (action?.controller_id) {
      const { data: cRows, error: cErr } = await db
        .from("controllers")
        .select("id, name, domain, metadata")
        .eq("id", action.controller_id)
        .limit(1);

      if (!cErr && cRows && cRows[0]) {
        controller = cRows[0];
      }
    }

    return NextResponse.json({
      ok: true,
      job,
      action,
      controller,
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[ops/webforms/:id] error:", e?.message || e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
