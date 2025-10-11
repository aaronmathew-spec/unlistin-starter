import type { ProviderInput, ProviderResult } from "./types";

/**
 * Lightweight SendGrid sender.
 * Requires:
 *   SENDGRID_API_KEY
 *   MAIL_FROM (verified sender)
 */
export async function sendWithSendgrid(msg: ProviderInput): Promise<ProviderResult> {
  const apiKey = process.env.SENDGRID_API_KEY || "";
  const from = process.env.MAIL_FROM || "";
  const to = msg.to?.trim();

  if (!apiKey || !from || !to) {
    return { ok: false, error: "sendgrid-misconfigured (SENDGRID_API_KEY / MAIL_FROM / MAIL_TO)" };
  }

  // We avoid adding the official SDK to keep deps light; use fetch to SendGrid REST
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject: msg.subject,
      content: [{ type: "text/plain", value: msg.text }],
    }),
  });

  if (res.ok || res.status === 202) {
    return { ok: true, id: res.headers.get("x-message-id") || "sendgrid-accepted" };
  }

  const errText = await res.text().catch(() => "");
  return { ok: false, error: `sendgrid-error:${res.status} ${errText}` };
}
