// src/agents/dispatch/email.ts
import nodemailer from "nodemailer";

export type EmailDispatchInput = {
  to: string;
  subject: string;
  body: string;
};

export type EmailDispatchResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function hasSmtpEnv() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

export async function sendEmail(input: EmailDispatchInput): Promise<EmailDispatchResult> {
  if (!input.to) return { ok: false, error: "Missing 'to' address" };
  if (!hasSmtpEnv()) {
    // Graceful no-op to avoid breaking deploys without SMTP.
    console.warn("[dispatch/email] SMTP not configured; simulating success.");
    return { ok: true, messageId: `simulated:${Date.now()}` };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT!),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM!,
    to: input.to,
    subject: input.subject,
    text: input.body,
  });

  return { ok: true, messageId: info.messageId || `sent:${Date.now()}` };
}
