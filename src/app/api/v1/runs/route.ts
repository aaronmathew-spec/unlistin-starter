export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requirePAT } from "../_auth";
import { checkRate } from "@/lib/rateLimit";
import { getIdempotencyKey } from "../_idempotency";
import { checkIdempotency, reserveIdempotency, storeIdempotentResponse } from "@/lib/idempotency";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  subjectId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const auth = await requirePAT(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const rl = await checkRate(`runs:${auth.userId}`);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const idem = getIdempotencyKey(req);
  if (idem) {
    const cached = await checkIdempotency(auth.userId, idem);
    if (cached?.response) return NextResponse.json(cached.response, { status: 200 });
    await reserveIdempotency(auth.userId, idem);
  }

  const body = await req.json();
  const parsed = Input.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });

  // Ownership check (subject must belong to this user)
  const { data: s, error: subjErr } = await db
    .from("subjects")
    .select("id,user_id")
    .eq("id", parsed.data.subjectId)
    .single();
  if (subjErr || !s || s.user_id !== auth.userId) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const { data: org } = await db.from("organizations").select("id").eq("user_id", auth.userId).limit(1).single();
  if (!org) return NextResponse.json({ error: "No organization found" }, { status: 400 });

  const runId = crypto.randomUUID();
  const initialState = {
    taskId: runId,
    subjectId: parsed.data.subjectId,
    orgId: org.id,
    stage: "initializing",
    subject: {},
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
    subject_id: parsed.data.subjectId,
    org_id: org.id,
    agent: "supervisor",
    state: initialState,
    status: "initializing",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  import("@/agents/supervisor").then(({ executeWorkflow }) => executeWorkflow(initialState).catch(console.error));

  const response = { runId, status: "queued" };
  if (idem) await storeIdempotentResponse(auth.userId, idem, response);
  return NextResponse.json(response, { status: 201 });
}
