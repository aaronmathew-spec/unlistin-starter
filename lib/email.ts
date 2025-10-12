/* eslint-disable @typescript-eslint/no-explicit-any */
export async function sendMail(opts: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  // soft-fail if not configured
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@unlistin.com";
  if (!host || !user || !pass) return { ok: false, skipped: "smtp_not_configured" };

  let nodemailer: any;
  try {
    const mod = await import("nodemailer");
    nodemailer = (mod as any).default ?? mod;
  } catch {
    return { ok: false, skipped: "nodemailer_missing" };
  }

  const transporter = nodemailer.createTransport({
    host, port, secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "send failed" };
  }
}
