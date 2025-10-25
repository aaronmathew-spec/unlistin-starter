// app/api/ops/sla/auto-nudge/route.ts
// Sends SLA reminders for selected controllers+subjects (authorization footer included).
// Cron-guarded and feature-flagged (FLAG_SLA_EMAIL_ENABLED). No schema writes.

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

/**
 * Input:
 * {
 *   tenantId: "default",
 *   from?: "no-reply@xyz",
 *   items: [
 *     {
 *       controllerKey: "naukri",
 *       controllerName?: "Naukri",
 *       subjectUserId: "user_123",
 *       subjectFullName: "Test User",
 *       subjectEmail?: "user@example.com",
 *       subjectPhone?: "+91-....",
 *       links?: ["https://..."],
 *       requestId?: "req_123",
 *       originalSubmittedAt?: "2025-10-20T10:00:00.000Z"
 *     }
 *   ]
 * }
 */
export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenantId || "default");
    const from = body.from ? String(body.from) : (process.env.SLA_FROM_EMAIL || "");
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json({ ok: true, sent: 0, results: [], note: "no_items" });
    }

    const enabled = flagEnabled();
    const results: Array<{ controllerKey: string; to?: string[]; ok: boolean; error?: string | null }> = [];

    for (const raw of items) {
      const controllerKey = String(raw.controllerKey || "");
      const controllerName = String(raw.controllerName || controllerKey);
      const subjectUserId = String(raw.subjectUserId || "");
      const subjectFullName = String(raw.subjectFullName || "");
      const subjectEmail = raw.subjectEmail ? String(raw.subjectEmail) : null;
      const subjectPhone = raw.subjectPhone ? String(raw.subjectPhone) : null;
      const links = Array.isArray(raw.links) ? raw.links.map(String) : [];
      const requestId = raw.requestId ? String(raw.requestId) : null;
      const originalSubmittedAt = raw.originalSubmittedAt ? String(raw.originalSubmittedAt) : null;

      if (!controllerKey || !subjectUserId || !subjectFullName) {
        results.push({ controllerKey, ok: false, error: "missing_required_fields" });
        continue;
      }

      const contacts = getControllerContacts(controllerKey);
      if (!contacts || !contacts.emails.length) {
        results.push({ controllerKey, ok: false, error: "no_controller_contacts" });
        continue;
      }

      const to = contacts.emails;
      const cc: string[] | undefined = contacts.cc;

      const text = buildNudgeBody({
        controllerName,
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

      if (!enabled) {
        results.push({ controllerKey, ok: true });
        continue;
      }

      const mail: SendEmailWithAuthInput = {
        to,
        cc,
        from,
        subject,
        text,
        authorization: { tenantId, subjectUserId, subjectFullName, subjectEmail, subjectPhone },
      };

      const res = await sendEmailWithAuthorization(mail);
      const ok = !!(res && (res.ok ?? true) !== false && !res.error);
      results.push({ controllerKey, to, ok, error: res?.error ?? null });
    }

    return NextResponse.json({
      ok: true,
      flagEnabled: enabled,
      policy: { ackHours: SLA.standard.ackHours, firstReminderHours: SLA.standard.firstReminderHours },
      sent: results.filter(r => r.ok).length,
      results,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
