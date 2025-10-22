// src/app/api/ops/webform/enqueue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { chooseHandler } from "@/src/lib/dispatch/choose-handler";

// Helpers (shims provided below; if you have your own, keep the same export names)
import { enqueueWebformJob } from "@/src/lib/webform/queue";
import { sendEmailViaResend } from "@/src/lib/email/dispatch";

export const runtime = "nodejs";

type EnqueueBody = {
  subjectId: string;
  countryCode: string; // ISO-2
  siteKey: string;     // platform/site key
  emailPayload?: {
    subject?: string;
    body?: string;
    attachments?: Array<{ filename: string; content: string }>;
  };
  webformPayload?: Record<string, any>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EnqueueBody;
    const { subjectId, countryCode, siteKey } = body;

    if (!subjectId || !countryCode || !siteKey) {
      return NextResponse.json({ error: "Missing subjectId/countryCode/siteKey" }, { status: 400 });
    }

    const target = await chooseHandler({
      subjectId,
      countryCode: countryCode.toUpperCase(),
      siteKey: siteKey.toLowerCase(),
    });

    if (target.kind === "webform") {
      await enqueueWebformJob({
        subjectId,
        url: target.url,
        meta: { label: target.label, ...(target.meta || {}), ...(body.webformPayload || {}) },
      });
      return NextResponse.json({ ok: true, channel: "webform", to: target.url, label: target.label });
    }

    if (target.kind === "email") {
      const subject = body.emailPayload?.subject ?? target.subject ?? `Removal request — ${target.label}`;
      const text = body.emailPayload?.body ?? `Please review the attached evidence for subject ${subjectId}.`;
      await sendEmailViaResend({
        to: target.to,
        subject,
        text,
        attachments: body.emailPayload?.attachments,
        meta: { label: target.label, ...(target.meta || {}) },
      });
      return NextResponse.json({ ok: true, channel: "email", to: target.to, label: target.label });
    }

    if (target.kind === "portal") {
      return NextResponse.json({ ok: true, channel: "portal", url: target.url, label: target.label });
    }

    if (target.kind === "api") {
      return NextResponse.json({ ok: true, channel: "api", url: target.url, label: target.label });
    }

    return NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
  } catch (e: any) {
    console.error("enqueue-error", e);
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
