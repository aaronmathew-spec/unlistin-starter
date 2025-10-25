// src/lib/email/send.ts
// Thin façade over the existing Resend sender to keep call sites stable.

import { sendEmail as resendSend, type SendEmailInput, type SendEmailResult } from "@/lib/email/resend";

export type { SendEmailInput, SendEmailResult };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // Future: add default FROM, DKIM/domain checks, tagging, SLA headers, etc.
  return resendSend(input);
}

export default sendEmail;
