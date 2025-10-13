// src/app/api/agents/webform/enqueue/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  actionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  url: z.string().url(),
  payload: z.record(z.any()).default({}),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { actionId, subjectId, url, payload } = Input.parse(body);

    // Auth + ownership of subject
    const supa = getServerSupabase();
    const { data: session } = await supa.auth.getUser();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: s, error: sErr } = await db
      .from("subjects")
      .select("user_id")
      .eq("id", subjectId)
      .single();
    if (sErr || !s) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    if (s.user_id !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Idempotent insert (do we already have a queued/succeeded job for this action?)
    const { data: existing } = await db
      .from("webform_jobs")
      .select("id, status")
      .eq("action_id", actionId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0 && existing[0].status !== "failed") {
      return NextResponse.json({ ok: true, message: "Job already exists", jobId: existing[0].id });
    }

    const { data: job, error: insErr } = await db
      .from("webform_jobs")
      .insert({
        action_id: actionId,
        subject_id: subjectId,
        url,
        payload,
        status: "queued",
        scheduled_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insErr) throw new Error(insErr.message);

    // Mark action as queued for webform
    await db
      .from("actions")
      .update({
        status: "escalate_pending",
        next_attempt_at: new Date().toISOString(),
      })
      .eq("id", actionId);

    return NextResponse.json({ ok: true, job });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 });
    }
    console.error("[webform/enqueue] error:", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
