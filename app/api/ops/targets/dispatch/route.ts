// app/api/ops/targets/dispatch/route.ts
// Cron-guarded fan-out dispatcher for a generated "targets plan".
// Accepts the payload shown in the /ops/targets/run page's cURL helper.
// Requires: header `x-secure-cron: <SECURE_CRON_SECRET>`

import { NextResponse } from "next/server";
import sendControllerRequest from "@/lib/dispatch/send";
import { buildDraftForController } from "@/lib/email/templates/controllers/draft";

export const runtime = "nodejs";

type SubjectPayload = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  subjectId?: string | null;
  handles?: string[] | null;
};

type ItemPayload = { key: string; name: string };

type DispatchBody = {
  region?: string | null;   // e.g., "IN"
  locale?: string | null;   // e.g., "en-IN"
  subject: SubjectPayload;
  items: ItemPayload[];
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function hasHeaderSecret(headers: Headers): boolean {
  const provided = headers.get("x-secure-cron")?.trim();
  const expected = process.env.SECURE_CRON_SECRET?.trim();
  return !!provided && !!expected && provided === expected;
}

function normStr(v?: string | null): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export async function POST(req: Request) {
  // Guard: secure-cron header
  if (!hasHeaderSecret(req.headers)) {
    return bad("unauthorized_cron");
  }

  let body: DispatchBody;
  try {
    body = (await req.json()) as DispatchBody;
  } catch {
    return bad("invalid_json");
  }

  // Validate minimal shape
  if (!body || !body.subject || !Array.isArray(body.items)) {
    return bad("invalid_payload");
  }
  const region = (normStr(body.region) || "IN") as string;
  const locale = (normStr(body.locale) || "en-IN") as string;

  const subjectFullName = normStr(body.subject.fullName);
  if (!subjectFullName) {
    return bad("subject_fullName_required");
  }

  const subjectEmail = normStr(body.subject.email);
  const subjectPhone = normStr(body.subject.phone);
  const subjectId = normStr(body.subject.subjectId);
  const handles = Array.isArray(body.subject.handles)
    ? body.subject.handles.filter((h) => !!normStr(h)).map((h) => String(h))
    : [];

  // Fan-out per item
  const results = await Promise.all(
    body.items.map(async (item) => {
      const controllerKey = String(item.key || "").toLowerCase();
      const controllerName = String(item.name || controllerKey || "Unknown");

      // Build a jurisdiction-aware draft (even if we currently dispatch webform-first,
      // this keeps the payload rich for the worker + proof artifacts).
      const draft = buildDraftForController({
        controllerKey,
        controllerName,
        region,
        subjectFullName,
        subjectEmail,
        subjectPhone,
        links: handles.length ? handles : null,
      });

      try {
        const res = await sendControllerRequest({
          controllerKey,
          controllerName,
          subject: {
            name: subjectFullName,
            email: subjectEmail,
            phone: subjectPhone,
            handle: handles[0] ?? null,
            id: subjectId,
          },
          locale,
          draft,           // workers can attach this in artifacts or webforms if helpful
          formUrl: null,   // allow policy/webform to decide defaults
          action: "create_request_v1",
          subjectId,
        });

        return {
          key: controllerKey,
          name: controllerName,
          ok: res.ok,
          channel: res.channel,
          providerId: res.providerId,
          error: res.error,
          note: res.note,
          idempotent: res.idempotent ?? null,
          hint: res.hint ?? null,
        };
      } catch (e: unknown) {
        const msg = (e as Error)?.message || String(e);
        return {
          key: controllerKey,
          name: controllerName,
          ok: false,
          channel: "webform" as const,
          providerId: null,
          error: "dispatch_exception",
          note: msg,
          idempotent: null as const,
          hint: "Exception during dispatch attempt",
        };
      }
    })
  );

  const okCount = results.filter((r) => r.ok).length;

  return NextResponse.json({
    ok: true,
    total: results.length,
    okCount,
    failCount: results.length - okCount,
    region,
    locale,
    subject: {
      fullName: subjectFullName,
      email: subjectEmail,
      phone: subjectPhone,
      subjectId,
      handles,
    },
    results,
  });
}
