/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendControllerRequest } from "@/lib/dispatch/send";
import { redactForLogs } from "@/lib/pii/redact";

/**
 * POST /api/pipeline/demo
 * Body example:
 * {
 *   "controllerKey": "naukri",
 *   "controllerName": "Naukri",
 *   "subject": { "name": "Rahul", "email": "rahul@example.com", "phone": "+91..." },
 *   "locale": "en-IN"
 * }
 */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const controllerKey = String(body.controllerKey || "").trim();
  const controllerName = String(body.controllerName || controllerKey || "").trim();
  if (!controllerKey || !controllerName) {
    return NextResponse.json(
      { ok: false, error: "Missing controllerKey/controllerName" },
      { status: 400 }
    );
  }

  // Safe structured log
  // eslint-disable-next-line no-console
  console.info("[pipeline.demo.in]", redactForLogs(body, { keys: ["email", "phone"] }));

  const res = await sendControllerRequest({
    controllerKey,
    controllerName,
    subject: {
      id: body.subject?.id ?? null,
      name: body.subject?.name ?? null,
      email: body.subject?.email ?? null,
      phone: body.subject?.phone ?? null,
      handle: body.subject?.handle ?? null,
    },
    locale: String(body.locale || "en-IN"),
    draft: body.draft
      ? { subject: body.draft.subject ?? null, bodyText: body.draft.bodyText ?? null }
      : undefined,
    formUrl: body.formUrl ?? null,
    action: "create_request_v1",
    subjectId: body.subjectId ?? null,
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
    idempotent: res.idempotent ?? "new",
    note: res.note ?? null,
  });
}
