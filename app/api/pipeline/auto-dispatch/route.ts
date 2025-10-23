/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendControllerRequest } from "@/lib/dispatch/send";
import {
  makeDedupeKey,
  wasRecentlyDispatched,
  recordDispatch,
} from "@/lib/dispatch/log";

const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();

function bad(status: number, msg: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: msg, ...(extra || {}) }, { status });
}

/**
 * POST /api/pipeline/auto-dispatch
 * Secured by x-secure-cron. Runs an idempotent controller dispatch for a subject.
 *
 * Body:
 * {
 *   "controllerKey": "truecaller",
 *   "controllerName": "Truecaller",
 *   "subject": { "name": "Rahul", "email": "rahul@example.com", "phone": "+91..." },
 *   "locale": "en-IN",
 *   "idempotencyKey": "optional-external-key"
 * }
 */
export async function POST(req: Request) {
  if (!OPS_SECRET) return bad(500, "SECURE_CRON_SECRET not configured");
  const sec = (req.headers.get("x-secure-cron") || "").trim();
  if (sec !== OPS_SECRET) return bad(403, "Invalid secret");

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return bad(400, "invalid_json");
  }

  const controllerKey = String(body.controllerKey || "").trim();
  const controllerName = String(body.controllerName || controllerKey || "").trim();
  if (!controllerKey || !controllerName) {
    return bad(400, "controllerKey and controllerName are required");
  }

  const subject = {
    id: body.subject?.id ?? null,
    name: body.subject?.name ?? null,
    email: body.subject?.email ?? null,
    phone: body.subject?.phone ?? null,
    handle: body.subject?.handle ?? null,
  };

  const locale = String(body.locale || "en-IN");

  // Prefer explicit idempotencyKey if provided
  const idemKey =
    (body.idempotencyKey && String(body.idempotencyKey).trim()) ||
    makeDedupeKey({ controllerKey, subject, locale });

  const already = await wasRecentlyDispatched(idemKey);
  if (already) {
    await recordDispatch({
      dedupeKey: idemKey,
      controllerKey,
      subject,
      locale,
      channel: "api",
      ok: true,
      note: "idempotent_skip:existing",
      providerId: null,
      error: null,
    });
    return NextResponse.json({ ok: true, note: "idempotent_skip:existing" });
  }

  const res = await sendControllerRequest({
    controllerKey,
    controllerName,
    subject,
    locale,
    draft: body.draft
      ? { subject: body.draft.subject ?? null, bodyText: body.draft.bodyText ?? null }
      : undefined,
    formUrl: body.formUrl ?? null,
    action: "create_request_v1",
    subjectId: body.subjectId ?? null,
  });

  const channel: "email" | "webform" | "api" =
    res.ok && (res.channel === "email" || res.channel === "webform") ? res.channel : "api";

  await recordDispatch({
    dedupeKey: idemKey,
    controllerKey,
    subject,
    locale,
    channel,
    ok: res.ok,
    providerId: res.ok ? (res.providerId ?? null) : null,
    error: res.ok ? null : (res.error ?? "unknown_error"),
    note: res.ok ? (res.note ?? null) : (res as any).hint ?? null,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error, note: res.note, hint: (res as any).hint ?? null },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    channel: res.channel,
    providerId: res.providerId ?? null,
    note: res.note ?? null,
  });
}
