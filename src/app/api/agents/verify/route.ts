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

/**
 * Input:
 *  - subjectId: required (ownership enforced)
 *  - actionId: optional (if provided, only verify this action; else verify all "in-flight")
 */
const InputSchema = z.object({
  subjectId: z.string().uuid(),
  actionId: z.string().uuid().optional(),
});

type ActionLite = {
  id: string;
  subject_id: string;
  controller_id: string | null;
  to: string | null;
  status:
    | "draft"
    | "sent"
    | "escalate_pending"
    | "escalated"
    | "needs_review"
    | "verified";
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subjectId, actionId } = InputSchema.parse(body);

    // --- Auth ---
    const supabase = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // --- Ownership check ---
    const { data: s, error: sErr } = await db
      .from("subjects")
      .select("user_id")
      .eq("id", subjectId)
      .single();
    if (sErr || !s) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }
    if (s.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // --- Load actions to verify ---
    let actions: ActionLite[] = [];
    if (actionId) {
      const { data, error } = await db
        .from("actions")
        .select("id, subject_id, controller_id, to, status")
        .eq("id", actionId)
        .eq("subject_id", subjectId)
        .limit(1);
      if (error) {
        throw new Error(`[verify] load action failed: ${error.message}`);
      }
      if (!data || data.length === 0) {
        return NextResponse.json({ error: "Action not found" }, { status: 404 });
      }
      actions = data as ActionLite[];
    } else {
      const { data, error } = await db
        .from("actions")
        .select("id, subject_id, controller_id, to, status")
        .eq("subject_id", subjectId)
        .in("status", ["sent", "escalate_pending", "escalated", "needs_review"])
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) {
        throw new Error(`[verify] load actions failed: ${error.message}`);
      }
      actions = (data || []) as ActionLite[];
    }

    // --- Verify each action (fault-tolerant loop) ---
    let verified = 0;
    let needsReview = 0;
    const results: Array<{
      actionId: string;
      status: "verified" | "needs_review" | "error";
      confidence?: number;
      dataFound?: boolean;
      evidence?: any;
      error?: string;
    }> = [];

    for (const a of actions) {
      try {
        // Your existing rich verification routine
        const res = await verifyActionPost(a as any);
        // Decide new status:
        //  - data found => still present => "needs_review"
        //  - not found  => "verified"
        const newStatus = res.dataFound ? "needs_review" : "verified";
        if (newStatus === "verified") verified++;
        else needsReview++;

        // Persist verification metadata on the action
        await db
          .from("actions")
          .update({
            status: newStatus,
            verification_info: {
              ...(a as any).verification_info,
              post: res.evidence,
              confidence: res.confidence,
              observed_present: res.dataFound,
            },
          })
          .eq("id", a.id);

        results.push({
          actionId: a.id,
          status: newStatus,
          confidence: res.confidence,
          dataFound: res.dataFound,
          evidence: res.evidence,
        });
      } catch (e: any) {
        // Do not abort the loop; record error for this action
        results.push({
          actionId: a.id,
          status: "error",
          error: e?.message || String(e),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      subjectId,
      checked: actions.length,
      verified,
      needsReview,
      results,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.issues },
        { status: 400 }
      );
    }
    console.error("[api/agents/verify] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
