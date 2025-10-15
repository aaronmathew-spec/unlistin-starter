// app/api/ops/email/test/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendEmailResend } from "@/lib/email/resend";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

export async function POST(req: Request) {
  const hdr = req.headers.get("x-secure-cron") || "";
  if (!OPS_SECRET || hdr !== OPS_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    to?: string | string[];
    subject?: string;
    text?: string;
  };

  const res = await sendEmailResend({
    to: body.to || "you@example.com",
    subject: body.subject || "UnlistIN Ops Test",
    text: body.text || "This is a test email from UnlistIN Ops.",
    tags: { type: "ops_test" },
  });

  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
