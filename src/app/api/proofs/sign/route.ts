// src/app/api/proofs/sign/route.ts
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
const sb = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  subjectId: z.string().uuid(),
  path: z.string().min(3), // storage path within proof-vault
  expiresIn: z.number().int().min(60).max(60 * 60).optional(), // 1 min .. 1 hr
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Input.parse(body);

    // auth
    const sv = getServerSupabase();
    const {
      data: { user },
      error: authErr,
    } = await sv.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ownership check
    const { data: subj, error: subjErr } = await sb
      .from("subjects")
      .select("user_id")
      .eq("id", parsed.subjectId)
      .single();
    if (subjErr || !subj) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    if (subj.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // simple path guard to enforce prefix = subjectId/
    if (!parsed.path.startsWith(parsed.subjectId + "/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const { data, error } = await sb.storage
      .from("proof-vault")
      .createSignedUrl(parsed.path, parsed.expiresIn ?? 300);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ url: data.signedUrl });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: e.errors }, { status: 400 });
    }
    console.error("[proofs/sign] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
