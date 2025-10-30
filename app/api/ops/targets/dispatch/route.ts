// app/api/ops/targets/dispatch/route.ts
import { NextResponse } from "next/server";
import sendControllerRequest from "@/lib/dispatch/send";
import { buildDraftForController } from "@/lib/email/templates/controllers/draft";
import { assertSecureCron, getClientIp } from "@/lib/ops/secure-cron";
import { createLogger } from "@/lib/ops/logger";
import { rateLimitByKey, tooMany } from "@/lib/rateLimit";

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
  region?: string | null; // e.g., "IN"
  locale?: string | null; // e.g., "en-IN"
  subject: SubjectPayload;
  items: ItemPayload[];
};

function bad(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function normStr(v?: string | null): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export async function POST(req: Request) {
  // --- 1) Secure-cron auth (header: x-secure-cron) ---
  let headers: Headers;
  try {
    headers = assertSecureCron(req); // throws Response(401) if invalid
  } catch (e) {
    // We can return the thrown Response directly, or map to NextResponse
    if (e instanceof Response) return e;
    return bad("unauthorized_cron", 403);
  }

  // --- 2) Rate limit per client IP (fails open if Upstash not configured) ---
  const clientIp = getClientIp(headers);
  const { allowed, reset, remaining } = await rateLimitByKey(`ops:dispatch:${clientIp}`, {
    max: 20,
    windowSec: 60,
  });
  if (!allowed) return tooMany({ reset, remaining });

  // --- 3) Parse/validate body ---
  let body: DispatchBody;
  try {
    body = (await req.json()) as DispatchBody;
  } catch {
    return bad("invalid_json");
  }

  if (!body || !body.subject || !Array.isArray(body.items)) {
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
    ? body.subject.handles.map((h) => normStr(h)).filter(Boolean).map((h) => String(h))
    : [];

  // --- 4) Structured logging ---
  const requestId =
    headers.get("x-request-id") ||
    headers.get("x-vercel-id") ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const log = createLogger("ops.dispatch", {
    requestId,
    ip: clientIp,
    region,
    locale,
    subjectId: subjectId || null,
  });

  log.info("targets_dispatch_start", {
    items: body.items.length,
    hasEmail: !!subjectEmail,
    hasPhone: !!subjectPhone,
  });

  // --- 5) Fan-out with timeout protection ---
  const controllerTimeoutMs = Number.parseInt(process.env.DISPATCH_CONTROLLER_TIMEOUT_MS ?? "25000", 10);
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
        const res = await Promise.race([
          Promise.resolve(
            sendControllerRequest({
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
            })
          ),
          new Promise((_resolve, reject) =>
            setTimeout(() => reject(new Error("controller_timeout")), controllerTimeoutMs)
          ),
        ]);

        const elapsed = Date.now() - t0;
        log.info("targets_dispatch_item", {
          key: controllerKey,
          channel: (res as any)?.channel,
          ok: (res as any)?.ok,
          providerId: (res as any)?.providerId || null,
          error: (res as any)?.error || null,
          idempotent: (res as any)?.idempotent ?? null,
          ms: elapsed,
        });

        return {
          key: controllerKey,
          name: controllerName,
          ok: !!(res as any)?.ok,
          channel: (res as any)?.channel ?? "webform",
          providerId: (res as any)?.providerId ?? null,
          error: (res as any)?.error ?? null,
          note: (res as any)?.note ?? null,
          idempotent: (res as any)?.idempotent ?? null,
          hint: (res as any)?.hint ?? null,
        };
      } catch (e: unknown) {
        const elapsed = Date.now() - t0;
        const isTimeout = (e as Error)?.message === "controller_timeout";
        const msg = (e as Error)?.message || String(e);
        log.error("targets_dispatch_item_exception", {
          key: controllerKey,
          error: msg,
          timeout: isTimeout || undefined,
          ms: elapsed,
        });
        return {
          key: controllerKey,
          name: controllerName,
          ok: false,
          channel: "webform",
          providerId: null,
          error: isTimeout ? "dispatch_timeout" : "dispatch_exception",
          note: msg,
          idempotent: null,
          hint: isTimeout ? "Controller request timed out" : "Exception during dispatch attempt",
        };
      }
    })
  );

  // --- 6) Summarize & respond ---
  const totalElapsed = Date.now() - started;
  const okCount = results.filter((r) => r.ok).length;

  log.info("targets_dispatch_done", {
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
