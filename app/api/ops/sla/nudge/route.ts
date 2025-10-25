// app/api/ops/sla/nudge/route.ts
// Cron-guarded SLA reminder email to a controller’s privacy/DPO contact.
// Uses sendEmailWithAuthorization() so our LoA/KYC manifest footer is included.
//
// Feature-flag: set FLAG_SLA_EMAIL_ENABLED=1 to enable sends.
// Without the flag, we no-op with ok:true + note.

import { NextResponse } from "next/server";
import { getControllerContacts } from "@/src/lib/controllers/contacts";
import {
  sendEmailWithAuthorization,
  type SendEmailWithAuthInput,
} from "@/src/lib/email/send";
import { buildNudgeBody, buildNudgeSubject } from "@/src/lib/email/templates/sla";
import { SLA } from "@/src/lib/sla/policy";

export const runtime = "nodejs";

function requireCronHeader(req: Request) {
  const secret = process.env.SECURE_CRON_SECRET || "";
  const got = req.headers.get("x-secure-cron") || "";
  if (!secret || got !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

function flagEnabled(): boolean {
  const v = String(process.env.FLAG_SLA_EMAIL_ENABLED || "0").trim();
  return v === "1" || v.toLowerCase() === "true";
}

export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));

    // Required – who to contact and who we act for
    const controllerKey = String(body.controllerKey || "");
    const tenantId = String(body.tenantId || "default");
    const subjectUserId = String(body.subjectUserId || ""); // your user id

    // Optional niceties for email copy
    const controllerName = String(body.controllerName || controllerKey);
    const subjectFullName = String(body.subjectFullName || "");
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : null;
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : null;
    const requestId = body.requestId ? String(body.requestId) : null;
    const originalSubmittedAt = body.originalSubmittedAt
      ? String(body.originalSubmittedAt)
      : null;
    const links = Array.isArray(body.links) ? body.links.map(String) : [];

    // Optional mail plumbing
    const from = body.from ? String(body.from) : (process.env.SLA_FROM_EMAIL || "");
    const ccInput = body.cc
      ? (Array.isArray(body.cc) ? body.cc.map(String) : [String(body.cc)])
      : undefined;

    if (!controllerKey || !subjectUserId || !subjectFullName) {
      return NextResponse.json(
        { ok: false, error: "missing required: controllerKey, subjectUserId, subjectFullName" },
        { status: 400 },
      );
    }

    const contacts = getControllerContacts(controllerKey);
    if (!contacts || !contacts.emails.length) {
      return NextResponse.json(
        { ok: false, error: "no_controller_contacts" },
        { status: 404 },
      );
    }

    const to = contacts.emails;
    const cc: string[] | undefined = ccInput ?? contacts.cc;

    // Build message
    const text = buildNudgeBody({
      controllerName: controllerName,
      subjectFullName,
      subjectEmail,
      subjectPhone,
      requestId,
      originalSubmittedAt,
      links,
      nextActionHint: null,
    });
    const subject = buildNudgeSubject({
      controllerName,
      subjectFullName,
      subjectEmail,
      subjectPhone,
      requestId,
      originalSubmittedAt,
      links,
      nextActionHint: null,
    });

    // Respect feature flag: return a dry-run if disabled.
    if (!flagEnabled()) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        note: "FLAG_SLA_EMAIL_ENABLED is not enabled. No email was sent.",
        target: { to, cc, from },
        policy: { ackHours: SLA.intimateFastLane.ackHours, standard: SLA.standard },
        preview: { subject, text },
      });
    }

    const mail: SendEmailWithAuthInput = {
      to,
      cc,
      from,
      subject,
      text,
      // Attach our authorization context for footer/attachment
      authorization: { tenantId, subjectUserId, subjectFullName, subjectEmail, subjectPhone },
    };

    const res = await sendEmailWithAuthorization(mail);
    return NextResponse.json({
      ok: true,
      result: res,
      target: { to, cc, from },
      policy: { ackHours: SLA.intimateFastLane.ackHours, standard: SLA.standard },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
