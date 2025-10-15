// app/api/pipeline/auto-dispatch/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendControllerRequest } from "@/lib/dispatch/send";
import {
  makeDedupeKey,
  wasRecentlyDispatched,
  recordDispatch,
} from "@/lib/dispatch/log";
import type { ControllerRequestInput } from "@/lib/dispatch/types";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
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
 *   "locale": "en"
 * }
 */
export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  const body = (await req.json().catch(() => ({}))) as Partial<ControllerRequestInput>;

  // Minimal validation
  if (!body.controllerKey || !body.controllerName) {
    return NextResponse.json(
      { ok: false, error: "controllerKey and controllerName are required" },
      { status: 400 }
    );
  }

  const subject = {
    name: body.subject?.name ?? null,
    email: body.subject?.email ?? null,
    phone: body.subject?.phone ?? null,
  };

  const locale: "en" | "hi" = (body.locale === "hi" ? "hi" : "en");

  // ✅ Correct shape for makeDedupeKey: subject goes under `subject`
  const dedupeKey = makeDedupeKey({
    controllerKey: body.controllerKey,
    subject,
    locale,
  });

  // Idempotency short-circuit (24h look-back by default)
  const already = await wasRecentlyDispatched(dedupeKey);
  if (already) {
    await recordDispatch({
      dedupeKey,
      controllerKey: body.controllerKey,
      subject,
      locale,
      channel: "api",
      ok: true,
      note: "idempotent_skip:existing",
    });
    return NextResponse.json({ ok: true, note: "idempotent_skip:existing" });
  }

  // Run the dispatch
  const input: ControllerRequestInput = {
    controllerKey: body.controllerKey,
    controllerName: body.controllerName!,
    subject,
    locale,
  };

  const res = await sendControllerRequest(input);

  // Structured audit
  await recordDispatch({
    dedupeKey,
    controllerKey: body.controllerKey,
    subject,
    locale,
    channel: res.ok ? res.channel : "api",
    ok: res.ok,
    providerId: res.providerId ?? null,
    error: res.ok ? null : res.error ?? "unknown_error",
    note: res.note ?? null,
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error, hint: res.hint ?? null },
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
