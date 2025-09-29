// app/api/agents/plan/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: plan, error } = await supabase.from("agent_plans").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: steps } = await supabase
    .from("agent_plan_steps")
    .select("*")
    .eq("plan_id", id)
    .order("idx", { ascending: true });

  return NextResponse.json({ plan, steps: steps ?? [] });
}
