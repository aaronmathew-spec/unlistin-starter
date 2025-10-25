// app/api/ops/dispatch/policy/route.ts
// Secure Ops endpoint that uses the policy-aware dispatcher.
// Non-breaking: this is additive and does not modify your legacy paths.

import { NextResponse } from "next/server";
import sendControllerRequest from "@/src/lib/dispatch/policySend";
import { asControllerKey } from "@/src/lib/controllers/dispatch";

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

    const controllerRaw = String(body.controller ?? body.controllerKey ?? "");
    if (!controllerRaw) {
      return NextResponse.json({ ok: false, error: "controller_required" }, { status: 400 });
    }

    let controller: ReturnType<typeof asControllerKey>;
    try {
      controller = asControllerKey(controllerRaw);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: "unknown_controller", detail: e?.message ?? String(e) },
        { status: 400 },
      );
    }

    const region = String(body.region ?? "DPDP_IN");
    const subjectFullName = body.subjectFullName ? String(body.subjectFullName) : undefined;
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : undefined;
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : undefined;
    const identifiers = (body.identifiers ?? {}) as Record<string, string | undefined>;
    const to = body.to as string | string[] | undefined;
    const from = body.from as string | undefined;

    const res = await sendControllerRequest({
      controller,
      region,
      subjectFullName,
      subjectEmail,
      subjectPhone,
      identifiers,
      to,
      from,
    });

    return NextResponse.json({ ok: res.ok, built: res.built, executed: res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "exception" }, { status: 500 });
  }
}
