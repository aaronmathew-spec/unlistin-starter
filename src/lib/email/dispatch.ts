// src/lib/email/dispatch.ts
import { Resend } from "resend";

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: string }>;
  meta?: Record<string, any>;
};

export async function sendEmailViaResend(args: SendArgs): Promise<void> {
  const { to, subject, text, attachments, meta } = args;

  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.EMAIL_FROM || "";
  const dryRun = String(process.env.EMAIL_DRY_RUN || "").toLowerCase() === "true";

  if (!from) {
    console.warn("[sendEmailViaResend] EMAIL_FROM missing; skipping send", { to, subject });
    return;
  }

  if (dryRun || !apiKey) {
    console.log("[sendEmailViaResend] DRY RUN", { to, subject, textLen: text?.length ?? 0, meta, attachmentsCount: attachments?.length ?? 0 });
    return;
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to,
    subject,
    text,
    attachments: (attachments || []).map((a) => ({
      filename: a.filename,
      content: a.content, // base64 or raw content per your upstream
    })),
    headers: {
      "X-UnlistIN-Label": meta?.label ?? "",
    },
  });
}
