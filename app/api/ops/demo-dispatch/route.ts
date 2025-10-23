/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureIdempotent } from "@/lib/guards/idempotency";
import { shouldAllowController, recordControllerFailure } from "@/lib/guards/circuit-breaker";
import { pushDLQ } from "@/lib/ops/dlq";

type Input = {
  controllerKey: string;
  subjectId: string;
  action?: string;   // e.g., "create_request_v1"
  simulateFail?: boolean;   // for demo
  simulateFinal?: boolean;  // for demo (pretend we've exhausted retries)
};

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Partial<Input>;
  const controllerKey = String(body.controllerKey || "").trim();
  const subjectId = String(body.subjectId || "").trim();
  const action = String(body.action || "create_request_v1");

  if (!controllerKey || !subjectId) return bad(400, "missing_fields");

  // 1) Idempotency (derive a stable key)
  const key = `${controllerKey}:${subjectId}:${action}`;
  const status = await ensureIdempotent(key, action);
  if (status === "exists") {
    return NextResponse.json({ ok: true, deduped: true });
  }

  // 2) Circuit Breaker check (per controller)
  const gate = await shouldAllowController(controllerKey);
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: "controller_circuit_open", recentFailures: gate.recentFailures },
      { status: 429 }
    );
  }

  // 3) Do work (replace this with your actual enqueue or execution)
  try {
    // DEMO failure toggles:
    if (body.simulateFail) {
      throw new Error("simulated webform_submit_failed");
    }

    // TODO: replace with your real enqueue (e.g., enqueueWebformJob({...}))
    // await enqueueWebformJob({ controllerKey, subjectId, ... })

    return NextResponse.json({ ok: true, enqueued: true });
  } catch (e: any) {
    // record failure for the breaker
    await recordControllerFailure(controllerKey, "webform_submit_failed", String(e?.message || e));

    // If this was the final attempt, push to DLQ
    if (body.simulateFinal) {
      await pushDLQ({
        channel: "webform",
        controller_key: controllerKey,
        subject_id: subjectId,
        payload: { controllerKey, subjectId, action }, // redact if needed
        error_code: "max_retries",
        error_note: String(e?.message || e),
        retries: 5, // example
      });
    }

    return bad(500, "enqueue_failed");
  }
}
