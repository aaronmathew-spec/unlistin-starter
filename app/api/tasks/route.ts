// app/api/tasks/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EnqueueTaskInput } from "@/lib/z";

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 50)));
  const cursor = searchParams.get("cursor"); // id cursor

  let q = supabase
    .from("tasks")
    .select("*")
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const c = Number(cursor);
    if (Number.isFinite(c)) q = q.lt("id", c);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = data ?? [];
  const nextCursor = rows.length === limit ? String(rows.at(-1)!.id) : null;

  return NextResponse.json({ tasks: rows, nextCursor });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();

  const body = await req.json().catch(() => ({}));
  const parsed = EnqueueTaskInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { type, request_id, payload } = parsed.data;

  // Insert task
  const { data, error } = await supabase
    .from("tasks")
    .insert({ request_id, type, payload, status: "queued" })
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Create initial run record (queued)
  if (data) {
    await supabase.from("task_runs").insert({ task_id: data.id, status: "queued" });
  }

  return NextResponse.json({ task: data });
}
