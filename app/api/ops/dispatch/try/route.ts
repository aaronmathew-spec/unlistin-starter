// app/api/ops/dispatch/try/route.ts
// Secure build+execute endpoint for policy-aware dispatches.
// This route does not replace your existing dispatcher; it's for Ops testing.

import { NextResponse } from "next/server";
import { buildDispatchForController, asControllerKey } from "@/src/lib/controllers/dispatch";
import { executeBuiltDispatch } from "@/src/lib/dispatch/execute";

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
    const region = String(body.region ?? "DPDP_IN");
    const subjectFullName = body.subjectFullName ? String(body.subjectFullName) : undefined;
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : undefined;
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : undefined;
    const identifiers = (body.identifiers ?? {}) as Record<string, string | undefined>;

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

    const built = await buildDispatchForController({
      controller,
      region,
      subjectFullName,
      subjectEmail,
      subjectPhone,
      identifiers,
    });

    // Optional "to" for email path; if omitted, executor tries registry contacts; if flag disabled & no `to`, returns typed error
    const to = body.to as string | string[] | undefined;
    const from = body.from as string | undefined;

    const executed = await executeBuiltDispatch(built, { to, from, controller });

    return NextResponse.json({ ok: true, built, executed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "exception" }, { status: 500 });
  }
}
