/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendControllerRequest } from "@/lib/dispatch/send";

const OPS_SECRET = (process.env.SECURE_CRON_SECRET || "").trim();

function bad(status: number, msg: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: msg, ...(extra || {}) }, { status });
}

export async function POST(req: Request) {
  // Ops-only endpoint — protect with secret
  if (!OPS_SECRET) return bad(500, "SECURE_CRON_SECRET not configured");
  const sec = (req.headers.get("x-secure-cron") || "").trim();
  if (sec !== OPS_SECRET) return bad(403, "Invalid secret");

  // Accept JSON or multipart
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  let body: any = {};
  try {
    if (ct.startsWith("application/json")) {
      body = await req.json();
    } else if (
      ct.startsWith("multipart/form-data") ||
      ct.startsWith("application/x-www-form-urlencoded")
    ) {
      const fd = await req.formData();
      body = Object.fromEntries(fd.entries());
      // parse nested JSON-like inputs if needed
      if (typeof body.subject === "string") {
        try { body.subject = JSON.parse(body.subject); } catch {}
      }
      if (typeof body.draft === "string") {
        try { body.draft = JSON.parse(body.draft); } catch {}
      }
    } else {
      return bad(415, "unsupported_content_type");
    }
  } catch {
    return bad(400, "invalid_body");
  }

  const controllerKey = String(body.controllerKey || body.controller_key || "").trim();
  const controllerName = String(body.controllerName || body.controller_name || controllerKey || "").trim();
  if (!controllerKey || !controllerName) {
    return bad(400, "controllerKey and controllerName are required");
  }

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
    formUrl: body.formUrl ?? body.form_url ?? null,
    action: body.action || "create_request_v1",
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
