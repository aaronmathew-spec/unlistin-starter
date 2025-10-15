// app/api/ops/dispatch/send/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendControllerRequest } from "@/lib/dispatch/send";
import type { ControllerRequestInput } from "@/lib/dispatch/types";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

function forbidden(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

export async function POST(req: Request) {
  if (!OPS_SECRET) return forbidden("SECURE_CRON_SECRET not configured");
  const header = req.headers.get("x-secure-cron") || "";
  if (header !== OPS_SECRET) return forbidden("Invalid secret");

  const body = (await req.json().catch(() => ({}))) as Partial<ControllerRequestInput> & {
    formUrl?: string;
  };

  // Minimal validation
  if (!body.controllerKey || !body.controllerName) {
    return NextResponse.json(
      { ok: false, error: "controllerKey and controllerName are required" },
      { status: 400 }
    );
  }

  const input: ControllerRequestInput = {
    controllerKey: body.controllerKey as ControllerRequestInput["controllerKey"],
    controllerName: body.controllerName!,
    subject: {
      name: body.subject?.name ?? undefined,
      email: body.subject?.email ?? undefined,
      phone: body.subject?.phone ?? undefined,
      // city tolerated if your types include it; otherwise ignored downstream
      ...(body.subject && "city" in body.subject ? { city: (body.subject as any).city } : {}),
    } as any,
    locale: (body.locale as "en" | "hi") || "en",
    // If your .d.ts does not yet include formUrl, sendControllerRequest will still read it safely.
    ...(typeof body.formUrl === "string" ? ({ formUrl: body.formUrl } as any) : {}),
  };

  const res = await sendControllerRequest(input);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error, hint: (res as any).hint }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    channel: res.channel,
    providerId: (res as any).providerId ?? null,
    note: (res as any).note,
  });
}
