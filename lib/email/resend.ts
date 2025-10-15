// lib/email/resend.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Resend } from "resend";

type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;         // plain text body (recommended to always include)
  html?: string;         // optional HTML body
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  tags?: Record<string, string | number | boolean>;
};

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string };

const KEY = process.env.RESEND_API_KEY || "";
const FROM = process.env.EMAIL_FROM || "";     // e.g. "UnlistIN <noreply@yourdomain.com>"
const DRY_RUN = (process.env.EMAIL_DRY_RUN || "").toLowerCase() === "true"; // "true" -> log-only

function asArray(x?: string | string[]): string[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export async function sendEmailResend(input: SendEmailInput): Promise<SendEmailResult> {
  const to = asArray(input.to).map((s) => s.trim()).filter(Boolean);
  const cc = asArray(input.cc).map((s) => s.trim()).filter(Boolean);
  const bcc = asArray(input.bcc).map((s) => s.trim()).filter(Boolean);
  const replyTo = asArray(input.replyTo).map((s) => s.trim()).filter(Boolean);

  if (!FROM) return { ok: false, error: "EMAIL_FROM is not set" };
  if (!to.length) return { ok: false, error: "No recipients" };
  if (!input.subject) return { ok: false, error: "Missing subject" };
  if (!input.text && !input.html) return { ok: false, error: "Provide text or html" };

  if (DRY_RUN || !KEY) {
    console.log("[email.dryrun] from=%s, to=%j, subject=%s, tags=%j", FROM, to, input.subject, input.tags || {});
    if (replyTo.length) console.log("[email.dryrun] replyTo=%j", replyTo);
    if (cc.length) console.log("[email.dryrun] cc=%j", cc);
    if (bcc.length) console.log("[email.dryrun] bcc=%j", bcc);
    if (input.text) console.log("[email.dryrun.text]\n%s", input.text.slice(0, 2000));
    if (input.html) console.log("[email.dryrun.html]\n%s", input.html.slice(0, 2000));
    return { ok: true, id: "dryrun-" + Date.now() };
  }

  try {
    const resend = new Resend(KEY);

    const tags =
      input.tags
        ? Object.entries(input.tags).map(([name, value]) => ({
            name,
            value: String(value),
          }))
        : undefined;

    const res = await resend.emails.send({
      from: FROM,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      replyTo: replyTo.length ? replyTo : undefined, // <-- camelCase here
      tags,
    });

    if ((res as any)?.error) {
      return { ok: false, error: (res as any).error.message || "send_failed" };
    }
    const id = (res as any)?.id || "";
    return id ? { ok: true, id } : { ok: false, error: "no_message_id" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "exception" };
  }
}
