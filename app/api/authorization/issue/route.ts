// app/api/authorization/issue/route.ts
// Creates a DPDP-style authorization record (server-only; uses service role).
// Call this after a user completes LoA + KYC upload in your product flow.

import { NextResponse } from "next/server";
import { putAuthorization } from "@/src/lib/compliance/authorization";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const tenantId = String(body.tenantId || "default");
    const subjectUserId = String(body.subjectUserId || "");
    const subjectFullName = String(body.subjectFullName || "");
    const subjectEmail = body.subjectEmail ? String(body.subjectEmail) : null;
    const subjectPhone = body.subjectPhone ? String(body.subjectPhone) : null;
    const loaSignedUrl = String(body.loaSignedUrl || "");
    const loaVersion = body.loaVersion ? String(body.loaVersion) : "v1";
    const kyc = Array.isArray(body.kyc) ? body.kyc : [];
    const scopeControllers = Array.isArray(body.scopeControllers)
      ? body.scopeControllers
      : null;

    if (!subjectUserId || !subjectFullName || !loaSignedUrl) {
      return NextResponse.json(
        { ok: false, error: "missing_required_fields" },
        { status: 400 }
      );
    }

    const rec = await putAuthorization({
      tenantId,
      subjectUserId,
      subjectFullName,
      subjectEmail,
      subjectPhone,
      loaSignedUrl,
      loaVersion,
      kyc,
      scopeControllers,
    });

    return NextResponse.json({ ok: true, authorization: rec });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "exception" },
      { status: 500 }
    );
  }
}
