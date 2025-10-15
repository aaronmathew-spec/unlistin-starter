// app/api/ops/email/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendEmailResend } from "@/lib/email/resend";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  const to = ADMIN_EMAILS[0];
  if (!to) return NextResponse.json({ ok: false, error: "No ADMIN_EMAILS set" }, { status: 400 });

  const body = await req.json().catch(() => ({} as any));
  const subject = body?.subject || "Unlistin: Email ops check";
  const text =
    body?.text ||
    `This is a test message from Unlistin ops.\n\nTime: ${new Date().toISOString()}\n`;

  const res = await sendEmailResend({
    to,
    subject,
    text,
    tags: { channel: "ops-test", env: process.env.VERCEL_ENV || "unknown" },
  });

  if (!("ok" in res) || res.ok !== true) {
    return NextResponse.json({ ok: false, error: res.error, code: res.code ?? undefined }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: res.id });
}
