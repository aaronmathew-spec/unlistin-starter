// src/lib/dispatch/send.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ensureIdempotent } from "@/lib/guards/idempotency";
import {
  shouldAllowController,
  recordControllerFailure,
} from "@/lib/guards/circuit-breaker";
import { pushDLQ } from "@/lib/ops/dlq";

// Adapter to your webform queue API
import { enqueueWebformJob } from "@/lib/webform/queue";

// Public types (for call-sites using ControllerRequestInput)
import type { ControllerRequestInput } from "@/lib/dispatch/types";

type Locale = string;

// Accept nulls from upstream and normalize inside
type SubjectProfile = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  handle?: string | null;
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
  locale?: Locale | null;
  draft?: { subject?: string | null; bodyText?: string | null } | null;
  formUrl?: string | null;
  action?: string | null;           // used for idempotency (default: create_request_v1)
  subjectId?: string | null;        // canonical subjectId if available
};

type SendResult = {
  ok: boolean;
  channel: "webform" | "email" | "noop";
  providerId: string | null;
  error: string | null;
  note: string | null;
  idempotent?: "deduped" | "new";
  hint?: string | null;             // some routes show an optional hint
};

function norm(v?: string | null): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

/** Map ControllerRequestInput -> internal SendInput (tolerant, no-throw) */
function mapToSendInput(input: ControllerRequestInput | SendInput): SendInput {
  // If it already looks like SendInput, return as-is.
  if ("controllerName" in input && "subject" in input) {
    return {
      controllerKey: (input as any).controllerKey,
      controllerName: (input as any).controllerName,
      subject: (input as any).subject ?? {},
      locale: (input as any).locale ?? null,
      draft: (input as any).draft ?? null,
      formUrl: (input as any).formUrl ?? null,
      action: (input as any).action ?? "create_request_v1",
      subjectId: (input as any).subjectId ?? null,
    };
  }
  // Fallback (shouldn’t hit, but keeps it safe)
  return {
    controllerKey: (input as any)?.controllerKey || "generic",
    controllerName: (input as any)?.controllerName || "Generic",
    subject: (input as any)?.subject || {},
    locale: (input as any)?.locale ?? null,
    draft: (input as any)?.draft ?? null,
    formUrl: (input as any)?.formUrl ?? null,
    action: (input as any)?.action ?? "create_request_v1",
    subjectId: (input as any)?.subjectId ?? null,
  };
}

function stableIdempotencyKey(input: SendInput): string {
  const action = norm(input.action) ?? "create_request_v1";
  const s = input.subject || {};
  // Prefer canonical subject ID, then email, phone, handle, then name.
  const subjectIdent =
    norm(input.subjectId) ??
    norm(s.id) ??
    norm(s.email) ??
    norm(s.phone) ??
    norm(s.handle) ??
    norm(s.name) ??
    "anon";
  return `${input.controllerKey}:${subjectIdent}:${action}`;
}

export async function sendDispatch(raw: ControllerRequestInput | SendInput): Promise<SendResult> {
  const input = mapToSendInput(raw);

  // 1) Idempotency guard
  const key = stableIdempotencyKey(input);
  const idem = await ensureIdempotent(key, norm(input.action) ?? "create_request_v1");
  if (idem === "exists") {
    return {
      ok: true,
      channel: "noop",
      providerId: null,
      error: null,
      note: "idempotent_deduped",
      idempotent: "deduped",
      hint: "Duplicate request suppressed by idempotency.",
    };
  }

  // 2) Circuit breaker guard for this controller
  const gate = await shouldAllowController(input.controllerKey);
  if (!gate.allow) {
    const rf = gate.recentFailures ?? 0;
    return {
      ok: false,
      channel: "noop",
      providerId: null,
      error: "controller_circuit_open",
      note: `recent_failures=${rf}`,
      idempotent: "new",
      hint: `Controller circuit is open due to recent failures (${rf}). Retry later or inspect Ops dashboard.`,
    };
  }

  // 3) Dispatch via webform (extend with email/SMS branches as needed)
  try {
    const wf = await enqueueWebformJob({
      controllerKey: input.controllerKey,
      controllerName: input.controllerName,
      subject: {
        name: norm(input.subject?.name),
        email: norm(input.subject?.email),
        phone: norm(input.subject?.phone),
        handle: norm(input.subject?.handle),
        id: norm(input.subject?.id),
      },
      locale: (input.locale || "en-IN") as Locale,
      draft: input.draft
        ? {
            subject: norm(input.draft.subject) ?? "",
            bodyText: norm(input.draft.bodyText) ?? "",
          }
        : undefined,
      formUrl: norm(input.formUrl),
    });

    const note = wf && (wf as any).id ? `enqueued:${(wf as any).id}` : null;

    return {
      ok: true,
      channel: "webform",
      providerId: (wf as any)?.id ?? null,
      error: null,
      note,
      idempotent: "new",
      hint: null,
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
      subject_id: norm(input.subjectId) ?? norm(input.subject?.id) ?? null,
      payload: {
        controllerKey: input.controllerKey,
        subject: input.subject,
        locale: input.locale || "en-IN",
        formUrl: norm(input.formUrl) ?? null,
        draft: input.draft ?? null,
        action: norm(input.action) ?? "create_request_v1",
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
      hint: "Failed to enqueue webform job; details recorded and DLQ’d.",
    };
  }
}

/**
 * Compatibility export for call-sites that do:
 *   import { sendControllerRequest } from "@/lib/dispatch/send";
 * and for default-imports:
 *   import sendControllerRequest from "@/lib/dispatch/send";
 */
export async function sendControllerRequest(
  input: ControllerRequestInput | SendInput
): Promise<SendResult> {
  return sendDispatch(input);
}
export default sendControllerRequest;

// (Optional) re-export useful types for local consumers
export type { SendInput, SendResult, SubjectProfile, Locale };
