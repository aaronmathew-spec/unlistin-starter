// app/api/ops/email/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendEmailResend } from "@/lib/email/resend";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

/**
 * POST /api/ops/email
 * Body: { to: string|string[], subject: string, text?: string, html?: string, cc?: string|string[], bcc?: string|string[], replyTo?: string, tags?: Record<string,string|number|boolean> }
 * Auth: header `x-secure-cron: <SECURE_CRON_SECRET>`
 */
export async function POST(req: Request) {
  const hdr = req.headers.get("x-secure-cron") || "";
  if (!OPS_SECRET || hdr !== OPS_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    to?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    tags?: Record<string, string | number | boolean>;
  };

  const res = await sendEmailResend({
    to: body.to || "",
    subject: body.subject || "",
    text: body.text,
    html: body.html,
    cc: body.cc,
    bcc: body.bcc,
    replyTo: body.replyTo,
    tags: body.tags,
  });

  if (!("ok" in res) || res.ok !== true) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: res.id });
}
