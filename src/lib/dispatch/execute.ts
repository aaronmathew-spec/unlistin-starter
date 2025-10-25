// src/lib/dispatch/execute.ts
// Execute channel-specific actions returned by the policy-aware builder.

export const runtime = "nodejs";

import type {
  BuiltDispatch,
  EmailPayload,
  WebformPayload,
} from "@/src/lib/controllers/dispatch";
import { sendEmail, type SendEmailResult } from "@/src/lib/email/send";
import { enqueueWebformJob } from "@/src/lib/controllers/webforms/enqueue";

export type ExecuteResult =
  | {
      ok: true;
      channel: "email";
      result: SendEmailResult;
    }
  | {
      ok: true;
      channel: "webform";
      result: { queued: true; queueId?: string; details?: Record<string, unknown> };
    }
  | {
      ok: false;
      channel: "email" | "webform";
      error: string;
    };

function isEmailPayload(x: BuiltDispatch): x is EmailPayload {
  return (x as any)?.channel === "email";
}

function isWebformPayload(x: BuiltDispatch): x is WebformPayload {
  return (x as any)?.channel === "webform";
}

export async function executeBuiltDispatch(
  built: BuiltDispatch,
  opts?: { to?: string | string[]; from?: string },
): Promise<ExecuteResult> {
  try {
    if (isEmailPayload(built)) {
      // NOTE: You may want to pick "to" from controller registry or tenant config.
      const to = Array.isArray(opts?.to) || typeof opts?.to === "string" ? opts?.to! : "privacy@example.com";
      const from = opts?.from || "no-reply@yourdomain";
      const res = await sendEmail({
        to,
        subject: built.subject,
        text: built.body,
      });
      return { ok: true, channel: "email", result: res };
    }

    if (isWebformPayload(built)) {
      const enq = await enqueueWebformJob({
        controller: built.controller,
        args: built.args as any,
      });
      if (!enq.ok) {
        return { ok: false, channel: "webform", error: enq.error };
      }
      return { ok: true, channel: "webform", result: { queued: true, queueId: enq.queueId, details: enq.details } };
    }

    return { ok: false, channel: "email", error: "unsupported_payload" };
  } catch (e: any) {
    return { ok: false, channel: (built as any)?.channel ?? "email", error: e?.message || String(e) };
  }
}
