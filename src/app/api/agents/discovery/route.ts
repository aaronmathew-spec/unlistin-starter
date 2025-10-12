// src/app/api/agents/discovery/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { runDiscovery } from "@/agents/discovery";
import type { DiscoveryInput } from "@/agents/discovery/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const InputSchema = z.object({
  // Option A: provide subjectId directly (preferred for idempotency)
  subjectId: z.string().uuid().optional(),

  // Option B: or pass subject fields (will create subject if missing)
  subject: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().min(5).max(32).optional(),
      name: z.string().min(1).max(200).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InputSchema.parse(body);

    // Require auth (same pattern as /api/agents/run)
    const supabase = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve or create subject
    let subjectId = parsed.subjectId ?? null;
    let email: string | null = null;
    let phone: string | null = null;
    let name: string | null = null;

    if (parsed.subjectId) {
      const { data: s, error: sErr } = await db
        .from("subjects")
        .select("id,email,phone_number,legal_name,user_id")
        .eq("id", parsed.subjectId)
        .single();
      if (sErr || !s) {
        return NextResponse.json(
          { error: "Subject not found" },
          { status: 404 }
        );
      }
      if (s.user_id !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      subjectId = s.id;
      email = s.email;
      phone = s.phone_number;
      name = s.legal_name;
    } else if (parsed.subject) {
      email = parsed.subject.email ?? null;
      phone = parsed.subject.phone ?? null;
      name = parsed.subject.name ?? null;

      const { data: s, error: insErr } = await db
        .from("subjects")
        .insert({
          user_id: user.id,
          email,
          phone_number: phone,
          legal_name: name,
        })
        .select("id")
        .single();
      if (insErr || !s) {
        return NextResponse.json(
          { error: "Failed to create subject" },
          { status: 500 }
        );
      }
      subjectId = s.id;
    } else {
      return NextResponse.json(
        { error: "Provide subjectId or subject" },
        { status: 400 }
      );
    }

    // Determine org for the user
    const { data: orgs, error: orgErr } = await db
      .from("organizations")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (orgErr || !orgs) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    const input: DiscoveryInput = {
      subjectId!,
      orgId: orgs.id,
      email,
      phone,
      name,
    };

    const result = await runDiscovery(input);

    return NextResponse.json({
      subjectId,
      inserted: result.inserted,
      message: "Discovery queued and stored in discovered_items.",
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: err.errors },
        { status: 400 }
      );
    }
    console.error("[api/agents/discovery] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
