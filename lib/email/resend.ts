// lib/email/resend.ts
/**
 * Minimal, safe Resend client. No PII persistence. Built for server-only use.
 */
import type { SendEmailInput, SendEmailResult } from "./types";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "";
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "";

function assertEnv() {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
  if (!EMAIL_FROM) throw new Error("EMAIL_FROM is not configured");
}

function toArray(x?: string | string[]): string[] | undefined {
  if (!x) return undefined;
  return Array.isArray(x) ? x : [x];
}

/** Primary send helper used by dispatch pipeline */
export async function sendEmailResend(input: SendEmailInput): Promise<SendEmailResult> {
  assertEnv();

  const payload: Record<string, any> = {
    from: EMAIL_FROM,
    to: toArray(input.to),
    subject: input.subject,
    text: input.text,
    html: input.html,
  };

  const cc = toArray(input.cc);
  const bcc = toArray(input.bcc);
  if (cc && cc.length) payload.cc = cc;
  if (bcc && bcc.length) payload.bcc = bcc;
  if (EMAIL_REPLY_TO) payload.reply_to = EMAIL_REPLY_TO;

  // Optional: pass-through headers/tags (Resend supports tags for analytics)
  if (input.headers) payload.headers = input.headers;
  if (input.tags) payload.tags = input.tags;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let err = `Resend error ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) err = `Resend error ${res.status}: ${j.message}`;
    } catch {}
    return { ok: false, error: err, code: res.status };
  }

  const data = (await res.json()) as { id?: string };
  return { ok: true, id: data?.id || "" };
}
