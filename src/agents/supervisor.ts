// src/agents/supervisor.ts
import type { AgentState } from "./types";
import { createClient } from "@supabase/supabase-js";

import { runDiscovery } from "@/agents/discovery";
import { createDraftActions } from "@/agents/request/draft";
import { dispatchDraftsForSubject } from "@/agents/dispatch/send";
import { captureAndStoreArtifacts } from "@/agents/verification/capture";
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

/**
 * Update agent_runs and emit signed webhooks (fire-and-forget).
 * Events: run.<status> (if provided) or run.updated
 */
async function setRunState(taskId: string, patch: Partial<AgentState>, status?: string) {
  const { data: run, error } = await db
    .from("agent_runs")
    .update({
      state: patch,
      status: status ?? (patch as any).stage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select("id, subject_id, status, updated_at")
    .single();

  if (error) {
    console.warn("[supervisor] agent_runs update failed:", error.message);
    return;
  }

  // Emit webhook asynchronously (non-blocking)
  (async () => {
    try {
      if (!run?.subject_id) return;

      // Find owning user for the subject
      const { data: s, error: sErr } = await db
        .from("subjects")
        .select("user_id")
        .eq("id", run.subject_id)
        .single();
      if (sErr || !s?.user_id) return;

      const event = status ? `run.${status}` : "run.updated";
      const payload = {
        runId: run.id,
        subjectId: run.subject_id,
        status: run.status,
        updatedAt: run.updated_at,
      };

      // Fire-and-forget webhook
      try {
        const mod = await import("@/lib/webhooks");
        await mod.emitWebhook(s.user_id, event, payload);
      } catch (wErr: any) {
        console.warn("[supervisor] webhook emit failed:", wErr?.message || wErr);
      }

      // Optional: lightweight audit log (best-effort)
      try {
        await db.from("audit_log").insert({
          user_id: s.user_id,
          action: "run_state_updated",
          target_type: "agent_run",
          target_id: run.id,
          meta: payload,
        });
      } catch {}
    } catch (e: any) {
      console.warn("[supervisor] webhook/audit sidecar error:", e?.message || e);
    }
  })().catch(() => {});
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
    .in("status", ["sent", "escalated", "escalate_pending"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`[supervisor] actions load failed: ${error.message}`);
  return data || [];
}

async function getSubject(subjectId: string) {
  const { data, error } = await db
    .from("subjects")
    .select("email, phone_number, legal_name")
    .eq("id", subjectId)
    .single();
  if (error) throw new Error(`[supervisor] subject fetch failed: ${error.message}`);
  return {
    email: (data as any)?.email as string | null,
    phone: (data as any)?.phone_number as string | null,
    name: (data as any)?.legal_name as string | null,
  };
}

function containsIdentifier(
  html: string,
  subject: { email?: string | null; phone?: string | null; name?: string | null }
) {
  const hay = (html || "").toLowerCase();
  const tests: string[] = [];
  if (subject.email) tests.push(subject.email.toLowerCase());
  if (subject.name) tests.push(subject.name.toLowerCase());
  if (subject.phone) {
    const d = subject.phone.replace(/[^\d]/g, "");
    if (d) {
      tests.push(d);
      if (d.length >= 6) tests.push(d.slice(-6));
    }
  }
  return tests.some((t) => t && hay.includes(t));
}

async function resolveTargetUrl(subjectId: string, controllerId: string | null, to: string | null) {
  const { data, error } = await db
    .from("discovered_items")
    .select("url")
    .eq("subject_id", subjectId)
    .eq("controller_id", controllerId)
    .not("url", "is", null)
    .limit(1);
  if (!error && data && data[0]?.url) return data[0].url as string;
  return to ?? null;
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
  for (const v of (data || []) as any[]) {
    const post = v?.evidence_artifacts?.post || {};
    if (typeof post.htmlHash === "string" && post.htmlHash.length > 0) hashes.push(post.htmlHash);
    if (typeof post.screenshotHash === "string" && post.screenshotHash.length > 0) hashes.push(post.screenshotHash);
  }
  return Array.from(new Set(hashes));
}

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
    state.stage = "request_generation"; // valid union value
    await setRunState(state.taskId, state, "request_generation");

    // 3) DISPATCH
    state.stage = "dispatch"; // valid union value
    await setRunState(state.taskId, state, "dispatch");

    await dispatchDraftsForSubject(state.subjectId);

    state = bumpProgress(state, "requestPercent", 100);
    await setRunState(state.taskId, state);

    // 4) VERIFICATION (rich artifact capture)
    state.stage = "verification";
    await setRunState(state.taskId, state, "verification");

    const actions = await loadActionsForVerify(state.subjectId);
    const subject = await getSubject(state.subjectId);

    for (const a of actions as any[]) {
      const targetUrl = await resolveTargetUrl(state.subjectId, a.controller_id, a.to);
      if (!targetUrl) {
        // No URL to check -> record minimal verification & mark verified
        await db.from("verifications").insert({
          action_id: a.id,
          subject_id: state.subjectId,
          controller_id: a.controller_id,
          data_found: false,
          confidence: 0.3,
          evidence_artifacts: { post: { reason: "no_url" } },
        });
        await db.from("actions").update({ status: "verified" }).eq("id", a.id);
        continue;
      }

      // Capture & store HTML + screenshot
      const cap = await captureAndStoreArtifacts({
        subjectId: state.subjectId,
        actionId: a.id,
        url: targetUrl,
      });

      // Independent presence check via HTML fetch (not from screenshot)
      let found = false;
      try {
        const res = await fetch(targetUrl, { method: "GET" });
        const html = res.ok ? await res.text() : "";
        found = containsIdentifier(html, subject);
      } catch {
        found = false;
      }

      const evidence = {
        url: targetUrl,
        status: cap.status,
        htmlHash: cap.htmlHash,
        screenshotHash: cap.screenshotHash,
        htmlPath: cap.htmlPath,
        screenshotPath: cap.screenshotPath,
      };

      await db.from("verifications").insert({
        action_id: a.id,
        subject_id: state.subjectId,
        controller_id: a.controller_id,
        data_found: found,
        confidence: found ? 0.9 : 0.8,
        evidence_artifacts: { post: evidence },
      });

      await db
        .from("actions")
        .update({
          status: found ? "needs_review" : "verified",
          verification_info: { post: evidence, observed_present: found },
        })
        .eq("id", a.id);
    }

    state = bumpProgress(state, "verificationPercent", 100);
    await setRunState(state.taskId, state);

    // 5) PROOF COMMIT (Merkle + Ed25519 signature)
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

    // COMPLETE
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

// Back-compat shim
export async function supervisorAgent(state: AgentState) {
  const out = await executeWorkflow(state);
  return {
    success: out.stage === "completed",
    updatedState: out,
  };
}
