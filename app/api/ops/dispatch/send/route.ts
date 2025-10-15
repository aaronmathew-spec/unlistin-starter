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

  const body = (await req.json().catch(() => ({}))) as Partial<ControllerRequestInput>;

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
      name: body.subject?.name ?? null,
      email: body.subject?.email ?? null,
      phone: body.subject?.phone ?? null,
    },
    locale: (body.locale as "en" | "hi") || "en",
  };

  const res = await sendControllerRequest(input);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error, hint: res.hint }, { status: 500 });
  }
  return NextResponse.json({ ok: true, channel: res.channel, providerId: res.providerId ?? null, note: res.note });
}
