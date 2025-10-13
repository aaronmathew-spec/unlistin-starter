// src/app/api/cron/auto-verify/route.ts
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

export async function GET(_req: NextRequest) {
  try {
    // Pull up to N sent actions for a rolling verification
    const { data: actions, error } = await db
      .from("actions")
      .select("id, subject_id, controller_id, to, status")
      .in("status", ["sent", "escalate_pending"])
      .limit(25);

    if (error) throw new Error(`[auto-verify] load failed: ${error.message}`);

    let verified = 0;
    let needsReview = 0;

    for (const a of actions || []) {
      const res = await verifyActionPost(a as any);
      const newStatus = res.dataFound ? "needs_review" : "verified";
      if (newStatus === "verified") verified++;
      else needsReview++;

      await db
        .from("actions")
        .update({
          status: newStatus,
          verification_info: {
            post: res.evidence,
            confidence: res.confidence,
            observed_present: res.dataFound,
          },
        })
        .eq("id", (a as any).id);
    }

    return NextResponse.json({
      ok: true,
      checked: actions?.length || 0,
      verified,
      needsReview,
    });
  } catch (e: any) {
    console.error("[cron/auto-verify] error:", e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
