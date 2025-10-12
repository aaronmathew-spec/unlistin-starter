export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AgentState } from "@/agents/types";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

const RunAgentRequestSchema = z.object({
  subject: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    name: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedInput = RunAgentRequestSchema.parse(body);

    const supabase = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbClient = db();
    const { data: subject, error: subjectError } = await dbClient
      .from("subjects")
      .insert({
        user_id: user.id,
        phone_number: validatedInput.subject.phone,
        email: validatedInput.subject.email,
        legal_name: validatedInput.subject.name,
      })
      .select()
      .single();

    if (subjectError) {
      console.error("[API] Subject creation error:", subjectError);
      return NextResponse.json({ error: "Failed to create subject" }, { status: 500 });
    }

    const { data: orgs } = await dbClient
      .from("organizations")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!orgs) {
      return NextResponse.json({ error: "No organization found" }, { status: 400 });
    }

    const taskId = crypto.randomUUID();
    const initialState: AgentState = {
      taskId,
      subjectId: subject.id,
      orgId: orgs.id,
      stage: "initializing",
      subject: validatedInput.subject,
      discoveredItems: [],
      policies: [],
      requests: [],
      evidence: [],
      errors: [],
      metadata: {
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
        progress: {
          discoveryPercent: 0,
          policyPercent: 0,
          requestPercent: 0,
          verificationPercent: 0,
        },
      },
    };

    await dbClient.from("agent_runs").insert({
      id: taskId,
      subject_id: subject.id,
      org_id: orgs.id,
      agent: "supervisor",
      state: initialState,
      status: "initializing",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Execute workflow asynchronously
    import("@/agents/supervisor").then(({ executeWorkflow }) => {
      executeWorkflow(initialState).catch(console.error);
    });

    return NextResponse.json({
      taskId,
      subjectId: subject.id,
      status: "queued",
      trackingUrl: `/api/agents/status/${taskId}`,
    });
  } catch (error: any) {
    console.error("[API] Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
