// src/agents/supervisor.ts
import type { AgentState } from "./types";
import { createClient } from "@supabase/supabase-js";

// Phase modules (already added in previous steps)
import { runDiscovery } from "@/agents/discovery";
import { createDraftActions } from "@/agents/request/draft";
import { dispatchDraftsForSubject } from "@/agents/dispatch/send";
import { verifyActionPost } from "@/agents/verification/run";
import { buildMerkleRoot, signRoot } from "@/lib/proofs/merkle";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const db = createClient(url, key, { auth: { persistSession: false } });

type ProgressKey =
  | "discoveryPercent"
  | "policyPercent"
  | "requestPercent"
  | "verificationPercent";

async function setRunState(taskId: string, patch: Partial<AgentState>, status?: string) {
  const { error } = await db
    .from("agent_runs")
    .update({
      state: patch,
      status: status ?? (patch as any).stage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) console.warn("[supervisor] agent_runs update failed:", error.message);
}

function bumpProgress(state: AgentState, key: ProgressKey, value: number): AgentState {
  return {
    ...state,
    metadata: {
      ...state.metadata,
      lastUpdatedAt: new Date(),
      progress: {
        ...state.metadata.progress,
        [key]: Math.max((state.metadata.progress as any)[key] ?? 0, Math.min(100, value)),
      },
    },
  };
}

async function loadActionsForVerify(subjectId: string) {
  const { data, error } = await db
    .from("actions")
    .select("id, subject_id, controller_id, to, status")
    .eq("subject_id", subjectId)
    .in("status", ["sent", "escalate_pending"])
    .limit(100);
  if (error) throw new Error(`[supervisor] actions load failed: ${error.message}`);
  return data || [];
}

async function collectVerificationHashes(subjectId: string) {
  const { data, error } = await db
    .from("verifications")
    .select("evidence_artifacts")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`[supervisor] verifications load failed: ${error.message}`);

  const hashes: string[] = [];
  for (const v of data || []) {
    const post = (v as any)?.evidence_artifacts?.post || {};
    if (typeof post.htmlHash === "string" && post.htmlHash.length > 0) hashes.push(post.htmlHash);
    if (typeof post.screenshotHash === "string" && post.screenshotHash.length > 0) hashes.push(post.screenshotHash);
  }
  return Array.from(new Set(hashes));
}

/**
 * Main autonomous pipeline. Called by /api/agents/run.
 */
export async function executeWorkflow(initial: AgentState) {
  let state = { ...initial };

  try {
    // 1) DISCOVERY
    state.stage = "discovery";
    await setRunState(state.taskId, state, "discovery");

    await runDiscovery({
      subjectId: state.subjectId,
      orgId: state.orgId,
      email: state.subject?.email,
      phone: state.subject?.phone,
      name: state.subject?.name,
    });

    state = bumpProgress(state, "discoveryPercent", 100);
    await setRunState(state.taskId, state);

    // 2) POLICY SYNTHESIS + DRAFT
    state.stage = "policy_synthesis";
    await setRunState(state.taskId, state, "policy_synthesis");

    await createDraftActions({ subjectId: state.subjectId });

    state = bumpProgress(state, "policyPercent", 100);
    state.stage = "draft_ready";
    await setRunState(state.taskId, state, "draft_ready");

    // 3) DISPATCH
    state.stage = "dispatching";
    await setRunState(state.taskId, state, "dispatching");

    await dispatchDraftsForSubject(state.subjectId);

    state = bumpProgress(state, "requestPercent", 80); // draft -> sent
    await setRunState(state.taskId, state);

    // 4) VERIFICATION (post-check, lightweight)
    state.stage = "verification";
    await setRunState(state.taskId, state, "verification");

    const actions = await loadActionsForVerify(state.subjectId);
    for (const a of actions) {
      try {
        const res = await verifyActionPost(a as any);
        const newStatus = res.dataFound ? "needs_review" : "verified";
        await db
          .from("actions")
          .update({
            status: newStatus,
            verification_info: {
              post: res.evidence,
              confidence: res.confidence,
              observed_present: res.dataFound,
            },
          })
          .eq("id", (a as any).id);
      } catch (e: any) {
        console.warn("[supervisor] verifyActionPost error:", e?.message || e);
      }
    }

    state = bumpProgress(state, "verificationPercent", 80);
    await setRunState(state.taskId, state);

    // 5) PROOF COMMIT (Merkle + signature)
    const hashes = await collectVerificationHashes(state.subjectId);
    if (hashes.length > 0) {
      const { rootHex } = buildMerkleRoot(hashes);
      const signature = await signRoot(rootHex);
      const { error: insErr } = await db
        .from("proof_ledger")
        .insert({
          subject_id: state.subjectId,
          merkle_root: rootHex,
          hsm_signature: signature,
          evidence_count: hashes.length,
        });
      if (insErr) throw new Error(`[supervisor] proof_ledger insert failed: ${insErr.message}`);
    }

    // 6) COMPLETE
    state.stage = "completed";
    state.metadata.lastUpdatedAt = new Date();
    await setRunState(state.taskId, state, "completed");
  } catch (err: any) {
    console.error("[supervisor] fatal:", err);
    state.errors = [
      ...state.errors,
      {
        agent: "supervisor",
        error: err?.message || String(err),
        timestamp: new Date(),
        recoverable: false,
      } as any,
    ];
    state.stage = "failed";
    await setRunState(state.taskId, state, "failed");
  }

  return state;
}

/**
 * Back-compat shim: some callers may still invoke supervisorAgent(state).
 * We run the pipeline once and return a minimal AgentResult-like shape.
 */
export async function supervisorAgent(state: AgentState) {
  const out = await executeWorkflow(state);
  return {
    success: out.stage === "completed",
    updatedState: out,
  };
}
