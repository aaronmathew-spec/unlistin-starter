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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.parse(body);

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
      .eq("id", parsed.subjectId)
      .single();

    if (sErr || !s) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    if (s.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const result = await dispatchDraftsForSubject(parsed.subjectId);

    return NextResponse.json({
      subjectId: parsed.subjectId,
      ...result,
      message: "Dispatch attempted for draft actions.",
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    console.error("[api/agents/dispatch] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
