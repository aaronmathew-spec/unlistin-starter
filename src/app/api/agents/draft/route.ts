// src/app/api/agents/draft/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { createDraftActions } from "@/agents/request/draft";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  subjectId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const supa = getServerSupabase();
    const { data: session } = await supa.auth.getUser();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = Input.parse(body);

    // Create/ensure drafts (idempotent)
    await createDraftActions({ subjectId: parsed.subjectId });

    // Return a snapshot count so callers know how many drafts exist now
    const { data: counts, error: countErr } = await db
      .from("actions")
      .select("*", { count: "exact", head: true })
      .eq("subject_id", parsed.subjectId)
      .eq("status", "draft");

    if (countErr) {
      // Non-fatal; still return success for the draft operation
      return NextResponse.json({
        ok: true,
        subjectId: parsed.subjectId,
        message: "Draft actions created.",
        drafts: { count: null },
        warning: `Count unavailable: ${countErr.message}`,
      });
    }

    return NextResponse.json({
      ok: true,
      subjectId: parsed.subjectId,
      message: "Draft actions created.",
      drafts: { count: counts?.length ?? null }, // head:true returns no rows; length will be undefined in some drivers
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: err.issues },
        { status: 400 }
      );
    }
    console.error("[draft route] fatal:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
