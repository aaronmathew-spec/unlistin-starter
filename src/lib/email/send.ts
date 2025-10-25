// src/lib/email/send.ts
// Thin façade over the existing Resend sender to keep call sites stable.

import { sendEmailResend, type SendEmailResult } from "@/lib/email/resend";

// Mirror the input shape expected by lib/email/resend.ts
export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;         // plain text body (recommended to always include)
  html?: string;         // optional HTML body
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  tags?: Record<string, string | number | boolean>;
};

export type { SendEmailResult };

/** Canonical façade used by higher-level code */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // Delegate to the underlying Resend-backed implementation
  return sendEmailResend(input as any);
}

export default sendEmail;
