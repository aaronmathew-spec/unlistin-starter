// src/lib/dispatch/guarded-send.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ensureIdempotent } from "@/lib/guards/idempotency";
import { shouldAllowController, recordControllerFailure } from "@/lib/guards/circuit-breaker";
import { pushDLQ } from "@/lib/ops/dlq";

// We import your existing dispatcher dynamically to avoid circular deps.
// IMPORTANT: this assumes you have something like `export async function send(input) { ... }` in send.ts
// and it returns { ok: boolean, ... }. If your function is named differently, change below.
async function callLegacySend(input: any) {
  const mod = await import("./send");
  const fn = (mod as any).send ?? (mod as any).default ?? null;
  if (typeof fn !== "function") {
    throw new Error("dispatch_send_not_found: expected export { send } in '@/lib/dispatch/send'");
  }
  return fn(input);
}

export type GuardedSendInput = {
  controllerKey: string;
  subjectId: string;
  action?: string; // e.g., "create_request_v1"
  // ... plus whatever fields your legacy send() expects
  [k: string]: any;
};

export type GuardedSendResult = {
  ok: boolean;
  deduped?: boolean;
  error?: string;
  // bubble up legacy fields
  [k: string]: any;
};

/**
 * Call this instead of your legacy send() from API routes.
 * - Adds idempotency + breaker
 * - For failures, records a breaker point
 * - Lets the worker handle retries & DLQ; optionally you can pushDLQ here on certain failures.
 */
export async function guardedSend(input: GuardedSendInput): Promise<GuardedSendResult> {
  const controllerKey = String(input.controllerKey || "").trim();
  const subjectId = String(input.subjectId || "").trim();
  if (!controllerKey || !subjectId) {
    return { ok: false, error: "missing_fields" };
  }

  // 1) Idempotency
  const key = `${controllerKey}:${subjectId}:${String(input.action || "create_request_v1")}`;
  const status = await ensureIdempotent(key, input.action || "create_request_v1");
  if (status === "exists") {
    return { ok: true, deduped: true };
  }

  // 2) Circuit breaker
  const gate = await shouldAllowController(controllerKey);
  if (!gate.allow) {
    return { ok: false, error: "controller_circuit_open", recentFailures: gate.recentFailures };
  }

  // 3) Delegate to your legacy dispatcher
  try {
    const res = await callLegacySend(input);
    return res;
  } catch (e: any) {
    // record breaker failure
    await recordControllerFailure(controllerKey, "dispatch_failed", String(e?.message || e));

    // Optional immediate DLQ (usually better to do this from worker after retries)
    // await pushDLQ({ channel: "webform", controller_key: controllerKey, subject_id: subjectId,
    //   payload: { ...input, _phase: "dispatch" }, error_code: "dispatch_failed", error_note: String(e) });

    return { ok: false, error: "dispatch_failed" };
  }
}

// Convenience DLQ export for workers (final failure)
export { pushDLQ };
