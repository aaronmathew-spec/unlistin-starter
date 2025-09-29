
// app/api/tasks/[id]/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const supabase = createSupabaseServerClient();
  const { data: task, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: runs } = await supabase
    .from("task_runs")
    .select("*")
    .eq("task_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({ task, runs: runs ?? [] });
}
