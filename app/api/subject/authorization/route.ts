// app/api/subject/authorization/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createAuthorization } from "@/src/lib/authz/store";
import type { AuthorizationInput } from "@/src/lib/authz/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AuthorizationInput;

    // Basic validation (strict but friendly)
    if (!body?.subject?.fullName) {
      return NextResponse.json({ ok: false, error: "subject.fullName is required" }, { status: 400 });
    }
    if (!body?.consentText || !body?.signedAt || !body?.signerName) {
      return NextResponse.json(
        { ok: false, error: "consentText, signedAt, and signerName are required" },
        { status: 400 }
      );
    }

    const res = await createAuthorization({
      subject: {
        subjectId: body.subject.subjectId ?? null,
        fullName: body.subject.fullName,
        email: body.subject.email ?? null,
        phone: body.subject.phone ?? null,
        region: body.subject.region ?? null,
      },
      consentText: body.consentText,
      signerName: body.signerName,
      signedAt: body.signedAt,
      artifacts: Array.isArray(body.artifacts) ? body.artifacts : [],
    });

    return NextResponse.json(
      {
        ok: true,
        authorizationId: res.record.id,
        manifest: res.manifest,
        files: res.files.map((f) => ({ path: f.path, mime: f.mime, bytes: f.bytes })),
      },
      { status: 200 }
    );
  } catch (e: any) {
    const msg = String(e?.message || e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
