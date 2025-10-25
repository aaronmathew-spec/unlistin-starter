// app/api/ops/targets/dispatch/route.ts
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

function bad(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
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

function log(event: string, payload: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

export async function POST(req: Request) {
  if (!hasHeaderSecret(req.headers)) {
    log("targets_dispatch_forbidden", {});
    return bad("unauthorized_cron", 403);
  }

  let body: DispatchBody;
  try {
    body = (await req.json()) as DispatchBody;
  } catch {
    log("targets_dispatch_invalid_json", {});
    return bad("invalid_json");
  }

  if (!body || !body.subject || !Array.isArray(body.items)) {
    log("targets_dispatch_invalid_payload", {});
    return bad("invalid_payload");
  }

  const region = (normStr(body.region) || "IN") as string;
  const locale = (normStr(body.locale) || "en-IN") as string;

  const subjectFullName = normStr(body.subject.fullName);
  if (!subjectFullName) return bad("subject_fullName_required");

  const subjectEmail = normStr(body.subject.email);
  const subjectPhone = normStr(body.subject.phone);
  const subjectId = normStr(body.subject.subjectId);
  const handles = Array.isArray(body.subject.handles)
    ? body.subject.handles.filter((h) => !!normStr(h)).map((h) => String(h))
    : [];

  log("targets_dispatch_start", {
    items: body.items.length,
    region,
    locale,
    subjectId: subjectId || null,
    hasEmail: !!subjectEmail,
    hasPhone: !!subjectPhone,
  });

  const started = Date.now();

  const results = await Promise.all(
    body.items.map(async (item) => {
      const controllerKey = String(item.key || "").toLowerCase();
      const controllerName = String(item.name || controllerKey || "Unknown");

      const draft = buildDraftForController({
        controllerKey,
        controllerName,
        region,
        subjectFullName,
        subjectEmail,
        subjectPhone,
        links: handles.length ? handles : null,
      });

      const t0 = Date.now();
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
          draft,
          formUrl: null,
          action: "create_request_v1",
          subjectId,
        });

        const elapsed = Date.now() - t0;
        log("targets_dispatch_item", {
          key: controllerKey,
          channel: res.channel,
          ok: res.ok,
          providerId: res.providerId || null,
          error: res.error || null,
          idempotent: res.idempotent || null,
          ms: elapsed,
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
        const elapsed = Date.now() - t0;
        const msg = (e as Error)?.message || String(e);
        log("targets_dispatch_item_exception", {
          key: controllerKey,
          error: msg,
          ms: elapsed,
        });
        return {
          key: controllerKey,
          name: controllerName,
          ok: false,
          channel: "webform",
          providerId: null,
          error: "dispatch_exception",
          note: msg,
          idempotent: null,
          hint: "Exception during dispatch attempt",
        };
      }
    })
  );

  const totalElapsed = Date.now() - started;
  const okCount = results.filter((r) => r.ok).length;

  log("targets_dispatch_done", {
    total: results.length,
    okCount,
    failCount: results.length - okCount,
    ms: totalElapsed,
  });

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
