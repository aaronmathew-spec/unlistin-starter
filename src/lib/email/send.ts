// src/lib/email/send.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

// Thin façade over Resend sender. Adds an opt-in variant that appends
// an authorization-manifest footer and (flag-gated) attaches the manifest JSON.

import {
  sendEmailSafe as resendSend,
  type SendEmailInput,
  type SendEmailResult,
} from "@/lib/email/resend";

import { resolveAuthorizationManifestFor } from "@/src/lib/compliance/authorization-read";

/** Re-export base types so call sites can stay concise */
export type { SendEmailInput, SendEmailResult };

/**
 * Plain pass-through (kept for back-compat).
 * Use this if you do NOT want to touch the body or attachments.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  return resendSend(input);
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
  const auth = input.authorization ?? null;

  if (!auth) {
    // Behave like plain sender
    return resendSend(input);
  }

  // Attempt to resolve latest authorization + manifest
  const rec = await resolveAuthorizationManifestFor({
    tenantId: auth.tenantId,
    subjectUserId: auth.subjectUserId,
  });

  if (!rec) {
    // No record—send as-is
    return resendSend(input);
  }

  const footer = buildManifestFooter({
    subjectFullName: auth.subjectFullName ?? rec.subjectFullName,
    subjectEmail: auth.subjectEmail ?? rec.subjectEmail ?? null,
    subjectPhone: auth.subjectPhone ?? rec.subjectPhone ?? null,
    manifestHash: rec.manifestHash,
  });

  // Compose updated text (do not touch html here; keep CSP-friendly plain text)
  const updated: SendEmailInput = {
    ...input,
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
        // Typical email APIs expect base64 + contentType
        contentType: "application/json",
      },
    ];
  }

  return resendSend(updated);
}

export default sendEmail;
