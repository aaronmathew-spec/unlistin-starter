// app/api/ops/email/sla/followup/route.ts
// Secure, explicit follow-up sender (non-breaking).
import { NextResponse } from "next/server";
import { buildFollowupEmail } from "@/src/lib/email/templates/followups";
import { sendEmail } from "@/src/lib/email/send";

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
    const controllerName = String(body.controllerName ?? body.controller ?? "Controller");
    const to = body.to as string | string[] | undefined;
    if (!to) {
      return NextResponse.json({ ok: false, error: "to_required" }, { status: 400 });
    }

    const region = String(body.region ?? "DPDP_IN");
    const subjectFullName = body.subjectFullName ? String(body.subjectFullName) : undefined;
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : undefined;
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : undefined;
    const ticketId = body.ticketId ? String(body.ticketId) : undefined;
    const daysElapsed = typeof body.daysElapsed === "number" ? body.daysElapsed : undefined;

    const { subject, body: text } = buildFollowupEmail({
      controllerName,
      region,
      subjectFullName,
      subjectEmail,
      subjectPhone,
      ticketId,
      daysElapsed,
    });

    const res = await sendEmail({
      to,
      subject,
      text,
    });

    return NextResponse.json({ ok: true, result: res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "exception" }, { status: 500 });
  }
}
