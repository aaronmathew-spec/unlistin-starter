// app/api/authz/manifest/route.ts
// Mint an Authorization Manifest for a subject (no persistence).
// POST body: { subject, region, permissions, evidence?, expiresInDays?, agent? }

import { NextResponse } from "next/server";
import { createAuthorizationManifest, type CreateManifestInput } from "@/src/lib/authz/manifest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<CreateManifestInput>;

    // Validate minimal shape
    if (!body?.subject || !body?.subject?.fullName || !body?.region || !Array.isArray(body?.permissions)) {
      return NextResponse.json(
        { ok: false, error: "invalid_input", hint: "Require subject.fullName, region, permissions[]" },
        { status: 400 },
      );
    }

    const manifest = createAuthorizationManifest({
      subject: {
        id: body.subject.id ?? null,
        fullName: String(body.subject.fullName),
        email: body.subject.email ?? null,
        phone: body.subject.phone ?? null,
        handles: Array.isArray(body.subject.handles) ? body.subject.handles : null,
      },
      region: String(body.region),
      permissions: (body.permissions as any[]).map((p) => String(p)) as any,
      evidence: Array.isArray(body.evidence)
        ? body.evidence.map((e: any) => ({
            kind: e?.kind,
            url: e?.url ?? null,
            notes: e?.notes ?? null,
          }))
        : [],
      expiresInDays:
        typeof body.expiresInDays === "number" && Number.isFinite(body.expiresInDays)
          ? body.expiresInDays
          : null,
      agent: body.agent ?? null,
    });

    return NextResponse.json({ ok: true, manifest });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "manifest_create_failed", note: msg }, { status: 500 });
  }
}
