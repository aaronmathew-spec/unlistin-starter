// lib/dispatch/send.ts
import type { ControllerRequestInput, DispatchResult } from "./types";
import { generateDraft } from "@/src/agents/request/generator";
import { getControllerPolicy } from "@/src/agents/policy";
import { sendEmailResend } from "@/lib/email/resend";
import { retry } from "@/lib/retry/backoff";
import { redactForLogs } from "@/lib/pii/redact";

/**
 * Optional placeholder for webform enqueue.
 * If you already have a worker enqueue function, wire it here instead.
 */
async function enqueueWebformJob(_args: {
  controllerKey: string;
  controllerName: string;
  subject: { name?: string | null; email?: string | null; phone?: string | null };
  locale: "en" | "hi";
  draft: { subject: string; bodyText: string };
}) {
  // TODO: integrate with your existing Playwright worker enqueue.
  // For now, return a no-op result so email fallback takes over if needed.
  return { ok: false as const, error: "webform_not_wired" };
}

/**
 * Primary entry to send a controller request.
 * - Builds a draft from templates (EN/HI).
 * - Respects policy preferred channel.
 * - Email path is production-ready (Resend + retry).
 * - Webform path is a safe placeholder (replace when you wire your worker).
 */
export async function sendControllerRequest(input: ControllerRequestInput): Promise<DispatchResult> {
  const locale = input.locale ?? "en";

  // Build draft (subject/body) using templates + policy hints footer
  const draft = generateDraft(input.controllerKey, input.controllerName, input.subject, locale);
  const policy = getControllerPolicy(input.controllerKey);

  // Safe structured log
  // eslint-disable-next-line no-console
  console.info("[dispatch.init]", redactForLogs({ input, policy, draftMeta: {
    preferredChannel: draft.preferredChannel,
    allowedChannels: draft.allowedChannels
  }}));

  // Try preferred channel first
  switch (draft.preferredChannel) {
    case "email": {
      const res = await sendEmailWithRetry({
        to: inferControllerEmailTo(input.controllerKey) ?? adminFallbackTo(),
        subject: draft.subject,
        text: draft.bodyText,
        tags: {
          controller: input.controllerKey,
          channel: "email",
          locale,
        },
      });

      if (res.ok) {
        return { ok: true, channel: "email", providerId: res.id };
      }
      // fall through to alternatives if policy allows
      if (policy.allowedChannels.includes("webform")) {
        const wf = await enqueueWebformJob({
          controllerKey: input.controllerKey,
          controllerName: input.controllerName,
          subject: input.subject,
          locale,
          draft: { subject: draft.subject, bodyText: draft.bodyText },
        });
        if (wf.ok) return { ok: true, channel: "webform", note: "Enqueued webform worker" };
      }
      return { ok: false, error: res.error, hint: "email_and_webform_attempted" };
    }

    case "webform": {
      // If webform not wired, try email as fallback (policy-defined)
      const wf = await enqueueWebformJob({
        controllerKey: input.controllerKey,
        controllerName: input.controllerName,
        subject: input.subject,
        locale,
        draft: { subject: draft.subject, bodyText: draft.bodyText },
      });
      if (wf.ok) return { ok: true, channel: "webform", note: "Enqueued webform worker" };

      if (policy.allowedChannels.includes("email")) {
        const res = await sendEmailWithRetry({
          to: inferControllerEmailTo(input.controllerKey) ?? adminFallbackTo(),
          subject: draft.subject,
          text: draft.bodyText,
          tags: {
            controller: input.controllerKey,
            channel: "email",
            locale,
          },
        });
        if (res.ok) return { ok: true, channel: "email", providerId: res.id };
        return { ok: false, error: res.error, hint: "webform_failed_email_failed" };
      }
      return { ok: false, error: "webform_not_wired", hint: "no_email_fallback_allowed" };
    }

    default: {
      // App/phone channels aren’t automated here; log and fail safe.
      return { ok: false, error: `Unsupported channel: ${draft.preferredChannel}` };
    }
  }
}

/** Centralized email send with retry/backoff + redaction on logs */
async function sendEmailWithRetry(payload: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  tags?: Record<string, string | number | boolean>;
}) {
  try {
    const out = await retry(
      () =>
        sendEmailResend({
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
          tags: payload.tags,
        }),
      { tries: 4, baseMs: 600, onRetry: (n, e) => console.warn("[email.retry]", n, e) }
    );
    if (!out.ok) {
      // eslint-disable-next-line no-console
      console.error("[email.failed]", redactForLogs({ payload, error: out.error }));
    }
    return out;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[email.exception]", redactForLogs({ payload, error: String(err?.message || err) }));
    return { ok: false as const, error: "exception_sending_email" };
  }
}

/**
 * Map controller → default email desk (if known).
 * You can improve this with real addresses or load from a controller table.
 */
function inferControllerEmailTo(controllerKey: string): string | undefined {
  switch (controllerKey) {
    case "naukri":
      // Example: return "privacy@naukri.com";
      return undefined;
    case "olx":
      return undefined;
    case "foundit":
      return undefined;
    case "shine":
      return undefined;
    case "timesjobs":
      return undefined;
    case "truecaller":
      return undefined;
    default:
      return undefined;
  }
}

/** Last-resort admin sink so tests don’t vanish if a desk email isn’t set yet */
function adminFallbackTo(): string {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // In production you may prefer to throw if missing:
  return list[0] || "admin@example.com";
}
