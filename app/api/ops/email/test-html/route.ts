// app/api/ops/email/test-html/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendEmailResend } from "@/lib/email/resend";
import { renderSimpleEmail } from "@/lib/email/templates/simple";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

export async function POST(req: Request) {
  const hdr = req.headers.get("x-secure-cron") || "";
  if (!OPS_SECRET || hdr !== OPS_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    to?: string | string[];
  };

  const { html, text } = renderSimpleEmail({
    title: "UnlistIN — HTML Template Check",
    intro: "This is a test message to verify HTML + text email rendering and deliverability.",
    bullets: [
      "Environment: " + (process.env.VERCEL_ENV || "unknown"),
      "Project: " + (process.env.VERCEL_PROJECT_PRODUCTION_URL || "local"),
    ],
    cta: { label: "Open Ops Webforms", href: "/ops/webforms" },
    footer: "If you did not request this test, you can ignore this email.",
    brand: { product: "UnlistIN", url: "https://"+(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").replace(/^https?:\/\//,"") },
  });

  const res = await sendEmailResend({
    to: body.to || "you@example.com",
    subject: "UnlistIN · HTML Template Test",
    text,
    html,
    tags: { type: "ops_test_html" },
  });

  if (!res.ok) {
    return NextResponse.json(res, { status: 500 });
  }
  return NextResponse.json(res);
}
