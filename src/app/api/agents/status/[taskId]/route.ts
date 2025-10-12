export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const { taskId } = params;

    const supabase = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbClient = db();
    const { data: agentRun, error } = await dbClient
      .from("agent_runs")
      .select("*")
      .eq("id", taskId)
      .single();

    if (error || !agentRun) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check authorization
    const { data: subject } = await dbClient
      .from("subjects")
      .select("user_id")
      .eq("id", agentRun.subject_id)
      .single();

    if (!subject || subject.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const state = agentRun.state;

    return NextResponse.json({
      taskId: agentRun.id,
      subjectId: agentRun.subject_id,
      status: agentRun.status,
      stage: state.stage,
      progress: state.metadata.progress,
      stats: {
        discoveredSources: state.discoveredItems?.length || 0,
        policiesGenerated: state.policies?.length || 0,
        requestsSent: state.requests?.filter((r: any) => r.status === "sent").length || 0,
        verificationsCompleted: state.requests?.filter((r: any) => r.status === "verified").length || 0,
      },
      errors: state.errors || [],
      createdAt: agentRun.created_at,
      updatedAt: agentRun.updated_at,
    });
  } catch (error) {
    console.error("[API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
