// app/api/ops/dispatch/preview/route.ts
// Secure preview of policy-aware dispatch selection (non-breaking).
// Use this to verify channel choice + payload before wiring the live dispatcher.

import { NextResponse } from "next/server";
import { buildDispatchForController } from "@/src/lib/controllers/dispatch";

export const runtime = "nodejs";

function requireCronHeader(req: Request) {
  const secret = process.env.SECURE_CRON_SECRET || "";
  const got = req.headers.get("x-secure-cron") || "";
  if (!secret || got !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const unauthorized = requireCronHeader(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json().catch(() => ({}));
    const controller = String(body.controller ?? body.controllerKey ?? "");
    const region = String(body.region ?? "DPDP_IN");
    const subjectFullName = body.subjectFullName ? String(body.subjectFullName) : undefined;
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : undefined;
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : undefined;
    const identifiers = (body.identifiers ?? {}) as Record<string, string | undefined>;

    if (!controller) {
      return NextResponse.json({ ok: false, error: "controller_required" }, { status: 400 });
    }

    const built = await buildDispatchForController({
      controller,
      region,
      subjectFullName,
      subjectEmail,
      subjectPhone,
      identifiers,
    });

    return NextResponse.json({ ok: true, built });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "exception" },
      { status: 500 },
    );
  }
}
