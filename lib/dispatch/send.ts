// lib/dispatch/send.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ControllerRequestInput, DispatchResult } from "./types";
import { generateDraft } from "@/src/agents/request/generator";
import { getControllerPolicy } from "@/src/agents/policy";
import { sendEmailResend } from "@/lib/email/resend";
import { retry } from "@/lib/retry/backoff";
import { redactForLogs } from "@/lib/pii/redact";
import { enqueueWebformJob } from "@/lib/webform/queue";
import { findRecentSuccess, insertDispatch } from "@/lib/dispatch/log";

/**
 * Primary entry to send a controller request.
 * - Builds a draft from templates (EN/HI).
 * - Respects policy preferred channel.
 * - Email path is production-ready (Resend + retry/backoff).
 * - Webform path enqueues a job (worker processes asynchronously).
 * - Seeds well-known form URLs when available via getDefaultFormUrl().
 * - NEW: Hard idempotency via dispatch_log (24h look-back; configurable via env).
 */
export async function sendControllerRequest(input: ControllerRequestInput): Promise<DispatchResult> {
  const locale = input.locale ?? "en";

  // Idempotency key: stable across retries for same controller+subject+locale
  const dedupeKey = toDedupeKey(input);

  // Optional: configure look-back window (minutes), default 24h
  const lookbackMin = clampInt(process.env.DISPATCH_IDEMPOTENCY_LOOKBACK_MIN ?? "", 24 * 60, 10, 7 * 24 * 60);

  // Short-circuit if a successful dispatch exists within lookback
  const recent = await findRecentSuccess(dedupeKey, lookbackMin);
  if (recent) {
    const note = `idempotent_skip:existing:${recent.id}`;
    await insertDispatch({
      dedupeKey,
      controllerKey: input.controllerKey,
      subject: input.subject,
      locale,
      channel: null,
      ok: true,
      providerId: null,
      note,
    });
    return { ok: true, channel: "email", note }; // channel isn't meaningful on skip; keep consistent type
  }

  const draft = generateDraft(input.controllerKey, input.controllerName, input.subject, locale);
  const policy = getControllerPolicy(input.controllerKey);

  // Safe structured log
  // eslint-disable-next-line no-console
  console.info(
    "[dispatch.init]",
    redactForLogs(
      {
        dedupeKey,
        input,
        policy: {
          controllerKey: policy.controllerKey,
          preferredChannel: policy.preferredChannel,
          allowedChannels: policy.allowedChannels,
          slas: policy.slas,
        },
        draftMeta: {
          preferredChannel: draft.preferredChannel,
          allowedChannels: draft.allowedChannels,
        },
      },
      { keys: ["email", "phone"] }
    )
  );

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

      // Audit
      await insertDispatch({
        dedupeKey,
        controllerKey: input.controllerKey,
        subject: input.subject,
        locale,
        channel: "email",
        ok: res.ok,
        providerId: res.ok ? res.id ?? null : null,
        error: res.ok ? null : res.error ?? "unknown_error",
        note: res.ok ? null : "email_failed",
      });

      if (res.ok) {
        return { ok: true, channel: "email", providerId: res.id };
      }

      // Fallback: enqueue webform if allowed
      if (policy.allowedChannels.includes("webform")) {
        const wf = await enqueueWebformJob({
          controllerKey: input.controllerKey,
          controllerName: input.controllerName,
          subject: input.subject,
          locale,
          draft: { subject: draft.subject, bodyText: draft.bodyText },
          formUrl: getDefaultFormUrl(input.controllerKey) ?? undefined,
        });

        await insertDispatch({
          dedupeKey,
          controllerKey: input.controllerKey,
          subject: input.subject,
          locale,
          channel: "webform",
          ok: !!wf,
          providerId: null,
          error: wf ? null : "webform_enqueue_failed",
          note: wf ? `enqueued:${wf.id}` : null,
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
        subject: input.subject,
        locale,
        draft: { subject: draft.subject, bodyText: draft.bodyText },
        formUrl: getDefaultFormUrl(input.controllerKey) ?? undefined,
      });

      await insertDispatch({
        dedupeKey,
        controllerKey: input.controllerKey,
        subject: input.subject,
        locale,
        channel: "webform",
        ok: !!wf,
        providerId: null,
        error: wf ? null : "webform_enqueue_failed",
        note: wf ? `enqueued:${wf.id}` : null,
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

        await insertDispatch({
          dedupeKey,
          controllerKey: input.controllerKey,
          subject: input.subject,
          locale,
          channel: "email",
          ok: res.ok,
          providerId: res.ok ? res.id ?? null : null,
          error: res.ok ? null : res.error ?? "unknown_error",
          note: res.ok ? null : "email_failed_after_webform_failed",
        });

        if (res.ok) return { ok: true, channel: "email", providerId: res.id };
        return { ok: false, error: res.error, hint: "webform_failed_email_failed" };
      }

      return { ok: false, error: "webform_enqueue_failed", hint: "no_email_fallback_allowed" };
    }

    default:
      await insertDispatch({
        dedupeKey,
        controllerKey: input.controllerKey,
        subject: input.subject,
        locale,
        channel: null,
        ok: false,
        error: `unsupported_channel:${String(draft.preferredChannel)}`,
      });
      return { ok: false, error: `Unsupported channel: ${draft.preferredChannel}` };
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
          return true; // unknown -> retry once
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
      return "https://www.truecaller.com/privacy-center/request/unlist";
    case "naukri":
    case "olx":
    case "foundit":
    case "shine":
    case "timesjobs":
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

/* ------------------- helpers ------------------- */

function toDedupeKey(input: ControllerRequestInput): string {
  const parts = [
    "v1", // version in case we ever change keying logic
    (input.controllerKey || "").toLowerCase(),
    norm(input.subject?.email) || "-",
    norm(input.subject?.phone) || "-",
    norm(input.subject?.name) || "-",
    input.locale || "en",
  ];
  return parts.join("|");
}

function norm(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  return s || null;
}

function clampInt(raw: string, def: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n)));
}
