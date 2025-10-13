// src/app/api/agents/verify/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { verifyActionPost } from "@/agents/verification/run";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const InputSchema = z.object({
  // Verify all "sent" actions for a subject, or a specific actionId
  subjectId: z.string().uuid(),
  actionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.parse(body);

    // Auth (same pattern)
    const supabase = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ownership check
    const { data: s, error: sErr } = await db
      .from("subjects")
      .select("user_id")
      .eq("id", parsed.subjectId)
      .single();
    if (sErr || !s) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    if (s.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Load actions to verify
    let actions: any[] = [];
    if (parsed.actionId) {
      const { data, error } = await db
        .from("actions")
        .select("id, subject_id, controller_id, to, status")
        .eq("id", parsed.actionId)
        .eq("subject_id", parsed.subjectId)
        .limit(1);
      if (error) throw new Error(`[verify] load action failed: ${error.message}`);
      if (!data || data.length === 0) {
        return NextResponse.json({ error: "Action not found" }, { status: 404 });
      }
      actions = data;
    } else {
      const { data, error } = await db
        .from("actions")
        .select("id, subject_id, controller_id, to, status")
        .eq("subject_id", parsed.subjectId)
        .in("status", ["sent", "escalate_pending"]) // verify those in flight
        .limit(50);
      if (error) throw new Error(`[verify] load actions failed: ${error.message}`);
      actions = data || [];
    }

    let verified = 0;
    let needsReview = 0;

    for (const a of actions) {
      const res = await verifyActionPost(a);
      const newStatus = res.dataFound ? "needs_review" : "verified"; // found => still present; needs further action
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
        .eq("id", a.id);
    }

    return NextResponse.json({
      subjectId: parsed.subjectId,
      checked: actions.length,
      verified,
      needsReview,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    console.error("[api/agents/verify] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
