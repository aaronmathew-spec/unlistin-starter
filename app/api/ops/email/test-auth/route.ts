// app/api/ops/email/test-auth/route.ts
// Ops-only test route to verify the auth-manifest footer and optional attachment.
// Secured by x-secure-cron. This does not alter your dispatcher or templates.

import { NextResponse } from "next/server";
import { sendEmailWithAuthorization } from "@/src/lib/email/send";

export const runtime = "nodejs";

function requireCronHeader(req: Request) {
  const secret = process.env.SECURE_CRON_SECRET || "";
  const got = req.headers.get("x-secure-cron") || "";
  if (!secret || got !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));

    const to = String(body.to || "");
    const from = String(body.from || "");
    const subject = String(body.subject || "UnlistIN · Test with Authorization Manifest");
    const text = String(body.text || "This is a test message.");
    const tenantId = String(body.tenantId || "default");
    const subjectUserId = String(body.subjectUserId || "");
    const subjectFullName = body.subjectFullName ? String(body.subjectFullName) : undefined;
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : undefined;
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : undefined;

    if (!to || !from || !subjectUserId) {
      return NextResponse.json(
        { ok: false, error: "missing required: to, from, subjectUserId" },
        { status: 400 },
      );
    }

    const result = await sendEmailWithAuthorization({
      to,
      from,
      subject,
      text,
      authorization: {
        tenantId,
        subjectUserId,
        subjectFullName,
        subjectEmail,
        subjectPhone,
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "exception" },
      { status: 500 },
    );
  }
}
