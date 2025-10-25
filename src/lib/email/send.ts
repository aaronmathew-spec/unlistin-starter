// src/lib/email/send.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

// Thin façade over your Resend sender. Adds an opt-in variant that appends
// an authorization-manifest footer and (flag-gated) attaches the manifest JSON.
// Resilient to different export shapes from "@/lib/email/resend" and SAFE during build.

import * as ResendMod from "@/lib/email/resend";
import { resolveAuthorizationManifestFor } from "@/src/lib/compliance/authorization-read";

/**
 * Minimal, safe local types (relaxed to match existing callers).
 */
export type AttachmentLike = {
  filename: string;
  content: string; // base64 when we add manifest
  contentType?: string;
  [k: string]: any;
};

export type SendEmailInput = {
  to: string | string[];
  from?: string;                  // optional to match existing callers
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: AttachmentLike[];
  [k: string]: any;               // allow provider-specific extras
};

export type SendEmailResult = {
  ok?: boolean;
  id?: string | null;
  error?: string | null;
  [k: string]: any;
};

/** Lazy resolution to avoid throwing during build/import time. */
let _baseSender: ((input: SendEmailInput) => Promise<SendEmailResult>) | null = null;

function resolveBaseSender(): (input: SendEmailInput) => Promise<SendEmailResult> {
  if (_baseSender) return _baseSender;

  const m: any = ResendMod;
  const candidate = m.sendEmail ?? m.sendEmailSafe ?? m.send ?? m.default;

  if (typeof candidate === "function") {
    _baseSender = candidate as (input: SendEmailInput) => Promise<SendEmailResult>;
    return _baseSender;
  }

  // Safe fallback: keep builds green and routes loadable.
  _baseSender = async (_input: SendEmailInput): Promise<SendEmailResult> => ({
    ok: false,
    id: null,
    error: "email_sender_not_configured",
  });
  return _baseSender;
}

/**
 * Plain pass-through (kept for back-compat).
 * Use this if you do NOT want to touch the body or attachments.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const baseSend = resolveBaseSender();
  return baseSend(input);
}

/**
 * Authorization context for manifest lookup.
 * - tenantId + subjectUserId are the join keys in `authorization` table
 * - name/email/phone are only for nicer footer text; not required
 */
export type AuthorizationContext = {
  tenantId: string;
  subjectUserId: string;
  subjectFullName?: string | null;
  subjectEmail?: string | null;
  subjectPhone?: string | null;
};

export type SendEmailWithAuthInput = SendEmailInput & {
  /** If provided, we try to append the manifest hash and (optionally) attach JSON. */
  authorization?: AuthorizationContext | null;
};

/** Feature flag: attach full manifest JSON as an email attachment */
function attachFlag(): boolean {
  const v = String(process.env.FLAG_ATTACH_AUTH_MANIFEST || "0").trim();
  return v === "1" || v.toLowerCase() === "true";
}

/** Build a short, CSP-safe footer that cites the manifest hash */
function buildManifestFooter(ctx: {
  subjectFullName?: string | null;
  subjectEmail?: string | null;
  subjectPhone?: string | null;
  manifestHash: string;
}) {
  const who = [ctx.subjectFullName, ctx.subjectEmail, ctx.subjectPhone]
    .filter(Boolean)
    .map((s) => String(s))
    .join(" · ");

  const lines = [
    "",
    "--",
    "Authorized privacy agent acting on behalf of the data subject.",
    who ? `Subject: ${who}` : null,
    `Authorization manifest (sha256): ${ctx.manifestHash}`,
  ].filter(Boolean);

  return lines.join("\n");
}

/**
 * Opt-in variant that appends an authorization footer and,
 * if flag-enabled, attaches authorization.manifest.json.
 *
 * Non-breaking:
 * - If no authorization is found or lookups fail, it simply behaves like sendEmail().
 */
export async function sendEmailWithAuthorization(
  input: SendEmailWithAuthInput,
): Promise<SendEmailResult> {
  const baseSend = resolveBaseSender();
  const auth = input.authorization ?? null;

  if (!auth) {
    // Behave like plain sender
    return baseSend(input);
  }

  // Attempt to resolve latest authorization + manifest
  const rec = await resolveAuthorizationManifestFor({
    tenantId: auth.tenantId,
    subjectUserId: auth.subjectUserId,
  });

  if (!rec) {
    // No record—send as-is
    return baseSend(input);
  }

  const footer = buildManifestFooter({
    subjectFullName: auth.subjectFullName ?? rec.subjectFullName,
    subjectEmail: auth.subjectEmail ?? rec.subjectEmail ?? null,
    subjectPhone: auth.subjectPhone ?? rec.subjectPhone ?? null,
    manifestHash: rec.manifestHash,
  });

  // Compose updated text (do not touch html here; keep CSP-friendly plain text)
  const updated: SendEmailInput = {
    ...(input as SendEmailInput),
    text: (input.text || "").trimEnd() + "\n" + footer + "\n",
  };

  // Optionally attach manifest JSON
  if (attachFlag()) {
    const manifestContent = rec.manifest;
    const buf = Buffer.from(manifestContent, "utf8");
    (updated as any).attachments = [
      ...((input as any).attachments || []),
      {
        filename: "authorization.manifest.json",
        content: buf.toString("base64"),
        contentType: "application/json",
      },
    ];
  }

  return baseSend(updated);
}

export default sendEmail;
