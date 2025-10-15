// app/api/pipeline/demo/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { sendControllerRequest } from "@/lib/dispatch/send";
import { redactForLogs } from "@/lib/pii/redact";

// Example: POST body you might send here after a UI selection:
// { "controllerKey": "naukri", "controllerName": "Naukri", "subject": { "name":"Rahul", "email":"rahul@example.com", "phone":"+91..." }, "locale":"hi" }

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    controllerKey?: any;
    controllerName?: string;
    subject?: { name?: string; email?: string; phone?: string };
    locale?: "en" | "hi";
  };

  if (!body.controllerKey || !body.controllerName) {
    return NextResponse.json({ ok: false, error: "Missing controllerKey/controllerName" }, { status: 400 });
  }

  // Safe structured log
  // eslint-disable-next-line no-console
  console.info("[pipeline.demo.in]", redactForLogs(body));

  const res = await sendControllerRequest({
    controllerKey: body.controllerKey,
    controllerName: body.controllerName,
    subject: {
      name: body.subject?.name ?? null,
      email: body.subject?.email ?? null,
      phone: body.subject?.phone ?? null,
    },
    locale: body.locale || "en",
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error, hint: res.hint }, { status: 500 });
  }
  return NextResponse.json({ ok: true, channel: res.channel, providerId: res.providerId ?? null });
}
