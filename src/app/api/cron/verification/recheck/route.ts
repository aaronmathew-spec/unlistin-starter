// src/app/api/cron/verification/recheck/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyActionPost } from "@/agents/verification/run";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

function hmacOk(req: NextRequest) {
  const secret = process.env.SECURE_CRON_SECRET;
  if (!secret) return false;
  const hdr = req.headers.get("x-cron-secret");
  return hdr === secret;
}

export async function POST(req: NextRequest) {
  try {
    if (!hmacOk(req)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Candidates: actions recently "sent" or "needs_review"
    // that have not been verified in the last 6 hours.
    const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();

    // Get last verification timestamp per action
    const { data: candidates, error } = await db
      .rpc("select_actions_for_recheck", { p_cutoff: sixHoursAgo }) // see SQL below
      .limit(25);

    if (error) throw new Error(error.message);

    let rechecked = 0;
    for (const a of (candidates || []) as any[]) {
      const res = await verifyActionPost({
        id: a.id,
        subject_id: a.subject_id,
        controller_id: a.controller_id,
        to: a.to,
        status: a.status,
      });

      const newStatus = res.dataFound ? "needs_review" : "verified";
      const confidence = res.dataFound ? 0.5 : 0.9; // multi-pass will raise this further

      // store verification
      await db.from("verifications").insert({
        action_id: a.id,
        subject_id: a.subject_id,
        controller_id: a.controller_id,
        data_found: res.dataFound,
        confidence,
        evidence_artifacts: { post: res.evidence },
      });

      // update action
      await db
        .from("actions")
        .update({
          status: newStatus,
          verification_info: {
            ...a.verification_info,
            last_recheck_at: new Date().toISOString(),
            observed_present: res.dataFound,
          },
        })
        .eq("id", a.id);

      rechecked++;
    }

    return NextResponse.json({ ok: true, rechecked });
  } catch (e: any) {
    console.error("[cron/recheck] error:", e?.message || e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
