// lib/dispatch/send.ts
import type { ControllerRequestInput, DispatchResult } from "./types";
import { generateDraft } from "@/src/agents/request/generator";
import { getRuntimePolicy } from "@/src/agents/policy"; // ⬅️ use DB-aware runtime policy
import { sendEmailResend } from "@/lib/email/resend";
import { retry } from "@/lib/retry/backoff";
import { redactForLogs } from "@/lib/pii/redact";
import { enqueueWebformJob } from "@/lib/webform/queue";

/**
 * Primary entry to send a controller request.
 * - Builds a draft from templates (EN/HI).
 * - Reads preferred channel & SLA from DB overrides (controllers_meta) via getRuntimePolicy().
 * - Email path is production-ready (Resend + retry/backoff).
 * - Webform path enqueues a job (worker processes asynchronously).
 * - Seeds well-known form URLs when available via getDefaultFormUrl(), but
 *   will honor an explicit input.formUrl if provided.
 */
export async function sendControllerRequest(input: ControllerRequestInput): Promise<DispatchResult> {
  const locale = input.locale ?? "en";

  // Accept an optional explicit formUrl even if not in the .d.ts (safe cast)
  const explicitFormUrl =
    typeof (input as any)?.formUrl === "string" ? ((input as any).formUrl as string).trim() : "";

  // Normalize subject so downstream never sees `null`
  const normSubject = {
    name: input.subject?.name ?? undefined,
    email: input.subject?.email ?? undefined,
    phone: input.subject?.phone ?? undefined,
    city: (input.subject as any)?.city ?? undefined,
  } as { name?: string; email?: string; phone?: string; city?: string };

  const draft = generateDraft(input.controllerKey, input.controllerName, normSubject, locale);

  // ⬇️ DB-aware policy (preferred channel + allowed list + SLA)
  const policy = await getRuntimePolicy(input.controllerKey);

  // Safe structured log
  // eslint-disable-next-line no-console
  console.info(
    "[dispatch.init]",
    redactForLogs(
      {
        input: { ...input, subject: normSubject, formUrl: explicitFormUrl || undefined },
        policy,
        draftMeta: {
          preferredChannel: draft.preferredChannel,
          allowedChannels: draft.allowedChannels,
        },
      },
      { keys: ["email", "phone"] }
    )
  );

  // Helper to resolve form URL with precedence: explicit -> known default -> undefined
  const formUrl = explicitFormUrl || getDefaultFormUrl(input.controllerKey) || undefined;

  // Effective preferred channel: prioritize draft preference, but ensure it’s allowed.
  const preferred = draft.preferredChannel;
  const isAllowed = policy.allowedChannels.includes(preferred as any);

  const channel: "email" | "webform" | "api" = isAllowed
    ? (preferred as any)
    : (policy.preferredChannel as any);

  switch (channel) {
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

      // Fallback: enqueue webform if allowed
      if (policy.allowedChannels.includes("webform")) {
        const wf = await enqueueWebformJob({
          controllerKey: input.controllerKey,
          controllerName: input.controllerName,
          subject: normSubject,
          locale,
          draft: { subject: draft.subject, bodyText: draft.bodyText },
          formUrl, // may be undefined; worker tolerates
        });
        return wf
          ? { ok: true, channel: "webform", note: `enqueued:${wf.id}` }
          : { ok: false, error: "webform_enqueue_failed" };
      }

      return { ok: false, error: res.error, hint: "email_and_webform_attempted" };
    }

    case "webform": {
      const wf = await enqueueWebformJob({
        controllerKey: input.controllerKey,
        controllerName: input.controllerName,
        subject: normSubject,
        locale,
        draft: { subject: draft.subject, bodyText: draft.bodyText },
        formUrl, // explicit (if present) or default
      });
      if (wf) return { ok: true, channel: "webform", note: `enqueued:${wf.id}` };

      // Fallback to email if allowed
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

      return { ok: false, error: "webform_enqueue_failed", hint: "no_email_fallback_allowed" };
    }

    default:
      return { ok: false, error: `Unsupported channel: ${channel}` };
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
      {
        tries: 4,
        baseMs: 600,
        retryOn: (err) => {
          const code = (err as any)?.code ?? (err as any)?.status;
          if (typeof code === "number") {
            return code === 429 || (code >= 500 && code < 600);
          }
          return true;
        },
        onRetry: (n, e, delay) =>
          console.warn("[email.retry]", n, delay, redactForLogs({ err: String((e as any)?.message || e) })),
      }
    );

    if (!out.ok) {
      // eslint-disable-next-line no-console
      console.error("[email.failed]", redactForLogs({ payload, error: out.error }, { keys: ["text", "html"] }));
    }
    return out;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(
      "[email.exception]",
      redactForLogs({ payload, error: String(err?.message || err) }, { keys: ["text", "html"] })
    );
    return { ok: false as const, error: "exception_sending_email" };
  }
}

/**
 * Controller -> default email desk mapping via env overrides.
 * Set env like:
 *   CONTROLLER_TRUECALLER_EMAIL, CONTROLLER_NAUKRI_EMAIL, ...
 * If not set, returns undefined and we fall back to ADMIN_EMAILS[0].
 */
function inferControllerEmailTo(controllerKey: string): string | undefined {
  const envKey = `CONTROLLER_${controllerKey.toUpperCase()}_EMAIL`;
  const value = process.env[envKey];
  if (value && value.trim()) return value.trim();
  return undefined;
}

/** Known/public webform or help URLs per controller (safe, public pages). */
function getDefaultFormUrl(controllerKey: string): string | null {
  switch (controllerKey.toLowerCase()) {
    case "truecaller":
      // Public unlisting/privacy request page (may redirect; handler tolerates)
      return "https://www.truecaller.com/privacy-center/request/unlist";
    case "naukri":
      return null;
    case "olx":
      return null;
    case "foundit":
      return null;
    case "shine":
      return null;
    case "timesjobs":
      return null;
    default:
      return null;
  }
}

/** Last-resort admin sink so tests don’t vanish if a desk email isn’t set yet */
function adminFallbackTo(): string {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list[0] || "admin@example.com";
}
