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
import { getControllerEntry, type ControllerKey } from "@/src/lib/controllers/registry";

const EMAIL_ENABLED =
  (process.env.FLAG_EMAIL_CHANNEL || "").toLowerCase() === "1" ||
  (process.env.FLAG_EMAIL_CHANNEL || "").toLowerCase() === "true";

const DEFAULT_FROM = process.env.EMAIL_FROM || "no-reply@yourdomain";

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
      hint?: string;
    };

function isEmailPayload(x: BuiltDispatch): x is EmailPayload {
  return (x as any)?.channel === "email";
}

function isWebformPayload(x: BuiltDispatch): x is WebformPayload {
  return (x as any)?.channel === "webform";
}

export async function executeBuiltDispatch(
  built: BuiltDispatch,
  opts?: {
    to?: string | string[];
    from?: string;
    controller?: ControllerKey; // used to fetch contacts if no `to` is supplied
  },
): Promise<ExecuteResult> {
  try {
    if (isEmailPayload(built)) {
      // Resolve recipient(s): explicit `to` wins; else try registry contacts; else fail fast (safe).
      let to = opts?.to;
      if (!to && opts?.controller) {
        const entry = getControllerEntry(opts.controller);
        if (entry?.contacts?.emails?.length) {
          to = entry.contacts.emails;
        }
      }

      if (!to) {
        return {
          ok: false,
          channel: "email",
          error: "email_recipient_missing",
          hint: "Provide `to` or add contacts.emails[] in the registry/tenant config.",
        };
      }

      if (!EMAIL_ENABLED && !opts?.to) {
        // Keep safe default: block implicit sends unless flag enabled or caller explicitly provides `to`.
        return {
          ok: false,
          channel: "email",
          error: "email_channel_disabled",
          hint: "Set FLAG_EMAIL_CHANNEL=1 or pass `to` explicitly for controlled sends.",
        };
      }

      const from = opts?.from || DEFAULT_FROM;
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
