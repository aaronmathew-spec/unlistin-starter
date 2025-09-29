// app/api/agents/plan/[id]/approve/route.ts
import { NextResponse } from "next/server";
import { FEATURE_AGENTS_SERVER } from "@/lib/flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAllowedTool } from "@/lib/mcp/registry";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!FEATURE_AGENTS_SERVER) {
    return NextResponse.json({ error: "Agents feature disabled" }, { status: 501 });
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid plan id" }, { status: 400 });

  const supabase = createSupabaseServerClient();

  // Load plan + steps visible to current user (RLS protects)
  const { data: plan, error: e1 } = await supabase.from("agent_plans").select("*").eq("id", id).maybeSingle();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: steps, error: e2 } = await supabase
    .from("agent_plan_steps")
    .select("*")
    .eq("plan_id", id)
    .order("idx", { ascending: true });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

  // Validate allowlist again and enqueue tasks (execution handled by task runner later)
  for (const s of steps ?? []) {
    if (!isAllowedTool(s.tool_key)) {
      return NextResponse.json({ error: `Tool not allowed: ${s.tool_key}` }, { status: 400 });
    }
  }

  // Create tasks for each step
  const taskInserts = (steps ?? []).map((s) => ({
    request_id: plan.request_id,
    type: `tool:${s.tool_key}`,
    payload: s.action,
    status: "queued",
    priority: 5,
  }));

  const { data: tasks, error: e3 } = await supabase.from("tasks").insert(taskInserts).select("*");
  if (e3) return NextResponse.json({ error: e3.message }, { status: 400 });

  // Mark steps queued and plan approved
  await supabase.from("agent_plan_steps").update({ status: "queued" }).eq("plan_id", id);
  await supabase.from("agent_plans").update({ status: "approved" }).eq("id", id);

  // Seed a 'queued' run per task
  if (tasks?.length) {
    await supabase.from("task_runs").insert(tasks.map((t: any) => ({ task_id: t.id, status: "queued" })));
  }

  return NextResponse.json({ ok: true, queued: tasks?.length ?? 0 });
}
