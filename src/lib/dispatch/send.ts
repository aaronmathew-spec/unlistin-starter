// src/lib/dispatch/send.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ensureIdempotent } from "@/lib/guards/idempotency";
import {
  shouldAllowController,
  recordControllerFailure,
} from "@/lib/guards/circuit-breaker";
import { pushDLQ } from "@/lib/ops/dlq";

// ---- Adapter to your webform queue API ----
// NOTE: use "@/lib/webform/queue" (not "@/src/...").
import { enqueueWebformJob } from "@/lib/webform/queue";

type Locale = string;

// Use optional string | undefined for smoother interop with callers
type SubjectProfile = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  handle?: string;
};

type SendInput = {
  controllerKey:
    | "generic"
    | "truecaller"
    | "naukri"
    | "olx"
    | "foundit"
    | "shine"
    | "timesjobs"
    | string;
  controllerName: string;
  subject: SubjectProfile;
  locale?: Locale;
  draft?: { subject?: string; bodyText?: string };
  formUrl?: string;
  action?: string; // used for idempotency (default: create_request_v1)
  subjectId?: string; // canonical subjectId if available
};

type SendResult = {
  ok: boolean;
  channel: "webform" | "email" | "noop";
  providerId: string | null;
  error: string | null;
  note: string | null;
  idempotent?: "deduped" | "new";
};

function stableIdempotencyKey(input: SendInput): string {
  const action = (input.action || "create_request_v1").trim();
  const s = input.subject || {};
  // Prefer canonical subject ID, then email, phone, handle, then name.
  const subjectIdent =
    (input.subjectId ||
      s.id ||
      s.email ||
      s.phone ||
      s.handle ||
      s.name ||
      "anon").toString();
  return `${input.controllerKey}:${subjectIdent}:${action}`;
}

export async function sendDispatch(input: SendInput): Promise<SendResult> {
  // 1) Idempotency guard
  const key = stableIdempotencyKey(input);
  const idem = await ensureIdempotent(key, input.action || "create_request_v1");
  if (idem === "exists") {
    return {
      ok: true,
      channel: "noop",
      providerId: null,
      error: null,
      note: "idempotent_deduped",
      idempotent: "deduped",
    };
  }

  // 2) Circuit breaker guard for this controller
  const gate = await shouldAllowController(input.controllerKey);
  if (!gate.allow) {
    return {
      ok: false,
      channel: "noop",
      providerId: null,
      error: "controller_circuit_open",
      note: `recent_failures=${gate.recentFailures ?? 0}`,
      idempotent: "new",
    };
  }

  // 3) Dispatch via webform (extend with email/SMS branches as needed)
  try {
    const wf = await enqueueWebformJob({
      controllerKey: input.controllerKey,
      controllerName: input.controllerName,
      subject: {
        name: input.subject?.name ?? undefined,
        email: input.subject?.email ?? undefined,
        phone: input.subject?.phone ?? undefined,
        handle: input.subject?.handle ?? undefined,
        id: input.subject?.id ?? undefined,
      },
      locale: (input.locale || "en-IN") as Locale,
      draft: input.draft
        ? {
            subject: input.draft.subject ?? "",
            bodyText: input.draft.bodyText ?? "",
          }
        : undefined,
      formUrl: input.formUrl ?? undefined,
    });

    const note = wf && (wf as any).id ? `enqueued:${(wf as any).id}` : null;

    return {
      ok: true,
      channel: "webform",
      providerId: (wf as any)?.id ?? null,
      error: null,
      note,
      idempotent: "new",
    };
  } catch (e: any) {
    const msg = String(e?.message || e);

    // 4) Record breaker failure
    await recordControllerFailure(
      input.controllerKey,
      "webform_enqueue_failed",
      msg
    );

    // 5) DLQ immediately if enqueue is a hard fail
    await pushDLQ({
      channel: "webform",
      controller_key: input.controllerKey,
      subject_id: input.subjectId || input.subject?.id || null,
      payload: {
        controllerKey: input.controllerKey,
        subject: input.subject,
        locale: input.locale || "en-IN",
        formUrl: input.formUrl ?? null,
        draft: input.draft ?? null,
        action: input.action ?? "create_request_v1",
      },
      error_code: "enqueue_failed",
      error_note: msg,
      retries: 0,
    });

    return {
      ok: false,
      channel: "webform",
      providerId: null,
      error: "webform_enqueue_failed",
      note: msg,
      idempotent: "new",
    };
  }
}

/**
 * Compatibility export for call-sites that do:
 *   import { sendControllerRequest } from "@/lib/dispatch/send";
 * and for default-imports:
 *   import sendControllerRequest from "@/lib/dispatch/send";
 */
export const sendControllerRequest = sendDispatch;
export default sendControllerRequest;

// (Optional) Re-export types if useful elsewhere
export type { SendInput, SendResult, SubjectProfile, Locale };
