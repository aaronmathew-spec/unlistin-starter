// app/api/pipeline/auto-dispatch/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendControllerRequest } from "@/lib/dispatch/send";
import { makeDedupeKey, wasRecentlyDispatched, recordDispatch } from "@/lib/dispatch/log";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

type Body = {
  controllerKey: string;
  controllerName?: string;
  subject: { name?: string | null; email?: string | null; phone?: string | null };
  locale?: "en" | "hi";
  force?: boolean;           // bypass dedupe if true
  formUrl?: string | null;   // optional override for known webforms
};

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.controllerKey || !body.subject) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const locale = body.locale ?? "en";
  const dedupeKey = makeDedupeKey({
    controllerKey: body.controllerKey,
    name: body.subject.name ?? null,
    email: body.subject.email ?? null,
    phone: body.subject.phone ?? null,
    locale,
  });

  if (!body.force) {
    const recent = await wasRecentlyDispatched(dedupeKey, { hours: 24 });
    if (recent) {
      await recordDispatch({
        dedupeKey,
        controllerKey: body.controllerKey,
        subject: body.subject,
        locale,
        ok: true,
        channel: null,
        providerId: null,
        note: "skipped:dedupe_recent",
        error: null,
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "recent_dispatch_exists" });
    }
  }

  // Call your main dispatcher (honors policy + templates + webform/email paths)
  const res = await sendControllerRequest({
    controllerKey: body.controllerKey,
    controllerName: body.controllerName || body.controllerKey,
    subject: body.subject,
    locale,
    // safe pass-through; your dispatcher tolerates undefined
    ...(body.formUrl ? { formUrl: body.formUrl } : {}),
  } as any);

  await recordDispatch({
    dedupeKey,
    controllerKey: body.controllerKey,
    subject: body.subject,
    locale,
    ok: res.ok,
    channel: res.ok ? res.channel : null,
    providerId: (res as any).providerId ?? null,
    note: (res as any).note ?? null,
    error: res.ok ? null : (res as any).error ?? "unknown_error",
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: (res as any).error, hint: (res as any).hint }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    channel: res.channel,
    providerId: (res as any).providerId ?? null,
    note: (res as any).note ?? null,
  });
}
