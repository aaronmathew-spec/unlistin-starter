export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requirePAT } from "../_auth";
import { checkRate } from "@/lib/rateLimit";
import { getIdempotencyKey } from "../_idempotency";
import { checkIdempotency, reserveIdempotency, storeIdempotentResponse } from "@/lib/idempotency";
import { executeWorkflow } from "@/agents/supervisor";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(5).max(32).optional(),
  name: z.string().min(1).max(200).optional(),
  run: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  // Auth (PAT)
  const auth = await requirePAT(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  // Rate limit
  const rl = await checkRate(`subjects:${auth.userId}`);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  // Idempotency
  const idem = getIdempotencyKey(req);
  if (idem) {
    const cached = await checkIdempotency(auth.userId, idem);
    if (cached?.response) return NextResponse.json(cached.response, { status: 200 });
    await reserveIdempotency(auth.userId, idem);
  }

  // Validate
  const body = await req.json();
  const parsed = Input.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });

  // Create subject
  const { data: subj, error: insErr } = await db
    .from("subjects")
    .insert({
      user_id: auth.userId,
      email: parsed.data.email ?? null,
      phone_number: parsed.data.phone ?? null,
      legal_name: parsed.data.name ?? null,
    })
    .select("id")
    .single();

  if (insErr || !subj) return NextResponse.json({ error: insErr?.message || "Subject create failed" }, { status: 500 });

  // Ensure org
  const { data: org } = await db.from("organizations").select("id").eq("user_id", auth.userId).limit(1).single();
  const orgId = org?.id ?? null;

  // Optionally kick off autonomous run
  let runId: string | null = null;
  if (parsed.data.run && orgId) {
    runId = crypto.randomUUID();
    const initialState = {
      taskId: runId,
      subjectId: subj.id,
      orgId,
      stage: "initializing",
      subject: { email: parsed.data.email, phone: parsed.data.phone, name: parsed.data.name },
      discoveredItems: [],
      policies: [],
      requests: [],
      evidence: [],
      errors: [],
      metadata: {
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
        progress: { discoveryPercent: 0, policyPercent: 0, requestPercent: 0, verificationPercent: 0 },
      },
    } as any;

    await db.from("agent_runs").insert({
      id: runId,
      subject_id: subj.id,
      org_id: orgId,
      agent: "supervisor",
      state: initialState,
      status: "initializing",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // fire-and-forget
    import("@/agents/supervisor").then(({ executeWorkflow }) => executeWorkflow(initialState).catch(console.error));
  }

  const response = { subjectId: subj.id, runId, queued: Boolean(runId) };

  if (idem) await storeIdempotentResponse(auth.userId, idem, response);
  return NextResponse.json(response, { status: 201 });
}
