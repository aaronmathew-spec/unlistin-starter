// src/app/api/ops/webform/enqueue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { chooseHandler } from "@/src/lib/dispatch/choose-handler";

// Reuse your existing helpers if you have them:
import { enqueueWebformJob } from "@/src/lib/webform/queue";     // <-- adjust path/name if different
import { sendEmailViaResend } from "@/src/lib/email/dispatch";   // <-- adjust path/name if different

export const runtime = "nodejs";

// Example request body shape — adapt to your existing fields
type EnqueueBody = {
  subjectId: string;         // internal subject / case id
  countryCode: string;       // ISO-2, e.g. "IN"
  siteKey: string;           // e.g. "instagram", "gov-ncii"
  emailPayload?: {           // only used if email path is chosen
    subject?: string;
    body?: string;
    attachments?: Array<{ filename: string; content: string }>;
  };
  webformPayload?: Record<string, any>; // extra form data for worker
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EnqueueBody;
    const { subjectId, countryCode, siteKey } = body;

    if (!subjectId || !countryCode || !siteKey) {
      return NextResponse.json({ error: "Missing subjectId/countryCode/siteKey" }, { status: 400 });
    }

    // ✨ NEW: central selection via resolver
    const target = await chooseHandler({ subjectId, countryCode: countryCode.toUpperCase(), siteKey: siteKey.toLowerCase() });

    // Decide by channel
    if (target.kind === "webform") {
      // Your existing worker enqueue (Playwright runner will pick it up)
      await enqueueWebformJob({
        subjectId,
        url: target.url,
        meta: { label: target.label, ...(target.meta || {}), ...(body.webformPayload || {}) },
      });
      return NextResponse.json({ ok: true, channel: "webform", to: target.url, label: target.label });
    }

    if (target.kind === "email") {
      const subject = body.emailPayload?.subject ?? target.subject ?? `Removal request — ${target.label}`;
      const bodyText = body.emailPayload?.body ?? `Please review the attached evidence for subject ${subjectId}.`;
      await sendEmailViaResend({
        to: target.to,
        subject,
        text: bodyText,
        attachments: body.emailPayload?.attachments,
        meta: { label: target.label, ...(target.meta || {}) },
      });
      return NextResponse.json({ ok: true, channel: "email", to: target.to, label: target.label });
    }

    if (target.kind === "portal") {
      // No automatic action — return URL so Analyst can follow the portal flow manually.
      return NextResponse.json({ ok: true, channel: "portal", url: target.url, label: target.label });
    }

    if (target.kind === "api") {
      // Future: platform API flow
      // enqueue a specific API job here if you want
      return NextResponse.json({ ok: true, channel: "api", url: target.url, label: target.label });
    }

    return NextResponse.json({ error: "Unsupported channel" }, { status: 400 });
  } catch (e: any) {
    console.error("enqueue-error", e);
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
