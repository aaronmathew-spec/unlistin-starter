// app/api/ops/targets/draft/route.ts
// Preview controller-specific draft (no email send). No cron header required (read-only).

import { NextResponse } from "next/server";
import { buildDraftForController } from "@/src/lib/email/templates/controllers/draft";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const controllerKey = String(body.controllerKey || "");
    const controllerName = body.controllerName ? String(body.controllerName) : null;
    const region = body.region ? String(body.region) : "IN";
    const subjectFullName = String(body.subjectFullName || "");
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : null;
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : null;
    const links = Array.isArray(body.links) ? body.links.map(String) : null;

    if (!controllerKey || !subjectFullName) {
      return NextResponse.json(
        { ok: false, error: "missing required: controllerKey, subjectFullName" },
        { status: 400 },
      );
    }

    const draft = buildDraftForController({
      controllerKey,
      controllerName,
      region,
      subjectFullName,
      subjectEmail,
      subjectPhone,
      links,
    });

    return NextResponse.json({ ok: true, draft });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
