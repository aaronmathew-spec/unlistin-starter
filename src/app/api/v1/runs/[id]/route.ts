export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePAT } from "../../_auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await requirePAT(_req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { data, error } = await db
    .from("agent_runs")
    .select("id, subject_id, status, state, created_at, updated_at")
    .eq("id", ctx.params.id)
    .limit(1)
    .single();

  if (error || !data) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  // Ensure the run belongs to this user (via subject ownership)
  const { data: subj } = await db.from("subjects").select("user_id").eq("id", data.subject_id).single();
  if (!subj || subj.user_id !== auth.userId) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  return NextResponse.json({ run: data });
}
