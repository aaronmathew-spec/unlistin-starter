export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { AgentState } from "@/agents/types";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

/**
 * Server-side DB client (service role preferred; falls back to anon if missing)
 */
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Request validation
 * - Require at least one of email or phone.
 */
const RunAgentRequestSchema = z.object({
  subject: z
    .object({
      phone: z.string().min(5).max(32).optional(),
      email: z.string().email().optional(),
      name: z.string().min(1).max(200).optional(),
    })
    .refine(
      (s) => Boolean(s.email || s.phone),
      "Provide at least one of email or phone."
    ),
});

export async function POST(request: NextRequest) {
  const startedAt = new Date();

  try {
    const body = await request.json();
    const validatedInput = RunAgentRequestSchema.parse(body);

    // Auth (server-side, tied to user session)
    const supabase = getServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbClient = db();

    // Create subject
    const { data: subject, error: subjectError } = await dbClient
      .from("subjects")
      .insert({
        user_id: user.id,
        phone_number: validatedInput.subject.phone ?? null,
        email: validatedInput.subject.email ?? null,
        legal_name: validatedInput.subject.name ?? null,
      })
      .select()
      .single();

    if (subjectError) {
      console.error("[API][agents/run] Subject creation error:", subjectError);
      return NextResponse.json(
        { error: "Failed to create subject" },
        { status: 500 }
      );
    }

    // Resolve org for this user
    const { data: orgs, error: orgErr } = await dbClient
      .from("organizations")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (orgErr || !orgs) {
      console.error("[API][agents/run] Organization lookup error:", orgErr);
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    // Initial AgentState
    const taskId = randomUUID();
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
        startedAt,
        lastUpdatedAt: startedAt,
        progress: {
          discoveryPercent: 0,
          policyPercent: 0,
          requestPercent: 0,
          verificationPercent: 0,
        },
      },
    };

    // Persist run record for tracking
    const { error: runInsertErr } = await dbClient.from("agent_runs").insert({
      id: taskId,
      subject_id: subject.id,
      org_id: orgs.id,
      agent: "supervisor",
      state: initialState,
      status: "initializing",
      created_at: startedAt.toISOString(),
      updated_at: startedAt.toISOString(),
    });

    if (runInsertErr) {
      console.error("[API][agents/run] agent_runs insert error:", runInsertErr);
      return NextResponse.json(
        { error: "Failed to start agent run" },
        { status: 500 }
      );
    }

    // Fire-and-forget supervisor (keep your existing contract)
    import("@/agents/supervisor")
      .then(async ({ executeWorkflow }) => {
        try {
          await executeWorkflow(initialState);
        } catch (err) {
          console.error("[Supervisor] executeWorkflow error:", err);
          // Best-effort: mark run as failed
          await dbClient
            .from("agent_runs")
            .update({
              status: "failed",
              state: {
                ...initialState,
                stage: "failed",
                errors: [
                  ...(initialState.errors ?? []),
                  { at: "initializing", reason: String(err) },
                ],
                metadata: {
                  ...initialState.metadata,
                  lastUpdatedAt: new Date(),
                },
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", taskId);
        }
      })
      .catch((err) => {
        console.error("[API][agents/run] dynamic import error:", err);
      });

    return NextResponse.json({
      taskId,
      subjectId: subject.id,
      status: "queued",
      trackingUrl: `/api/agents/status/${taskId}`,
    });
  } catch (error: any) {
    console.error("[API][agents/run] Handler error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
