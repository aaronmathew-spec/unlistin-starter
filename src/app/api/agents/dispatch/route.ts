// src/app/api/agents/dispatch/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { dispatchDraftsForSubject } from "@/agents/dispatch/send";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const InputSchema = z.object({
  subjectId: z.string().uuid(),
});

async function countByStatus(subjectId: string, status: string) {
  const { count, error } = await db
    .from("actions")
    .select("*", { count: "exact", head: true })
    .eq("subject_id", subjectId)
    .eq("status", status);
  if (error) return null;
  return typeof count === "number" ? count : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subjectId } = InputSchema.parse(body);

    // Auth
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
      .eq("id", subjectId)
      .single();

    if (sErr || !s) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    if (s.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Snapshot (before)
    const before = {
      draft: await countByStatus(subjectId, "draft"),
      escalate_pending: await countByStatus(subjectId, "escalate_pending"),
      sent: await countByStatus(subjectId, "sent"),
      needs_review: await countByStatus(subjectId, "needs_review"),
      verified: await countByStatus(subjectId, "verified"),
    };

    // Execute dispatch (idempotent, throttled, retry-aware)
    await dispatchDraftsForSubject(subjectId);

    // Snapshot (after)
    const after = {
      draft: await countByStatus(subjectId, "draft"),
      escalate_pending: await countByStatus(subjectId, "escalate_pending"),
      sent: await countByStatus(subjectId, "sent"),
      needs_review: await countByStatus(subjectId, "needs_review"),
      verified: await countByStatus(subjectId, "verified"),
    };

    return NextResponse.json({
      ok: true,
      subjectId,
      message: "Dispatch attempted for due actions.",
      before,
      after,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    }
    console.error("[api/agents/dispatch] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
