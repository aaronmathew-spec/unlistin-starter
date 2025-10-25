// app/api/subject/authorization/route.ts
// Creates an authorization record, uploads artifacts, builds a manifest, and returns everything.
// Relies on src/lib/authz/store.ts (createAuthorization / getAuthorization).

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorization, getAuthorization } from "@/src/lib/authz/store";

export const runtime = "nodejs";        // Buffer used in store.ts; ensure Node runtime
export const dynamic = "force-dynamic"; // avoid caching surprises for POST/GET

// Optional simple guard (tighten later with a shared secret if needed)
function assertAllowed(_req: Request) {
  // Example: check a header
  // const key = _req.headers.get("x-internal-key");
  // return key && key === process.env.INTERNAL_API_KEY;
  return true;
}

const ArtifactSchema = z.object({
  filename: z.string().min(1),
  mime: z.string().min(1),
  base64: z.string().min(1), // raw base64 (no data: prefix)
});

const BodySchema = z.object({
  subject: z.object({
    subjectId: z.string().optional().nullable(),
    fullName: z.string().min(1),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
  }),
  signerName: z.string().min(1),
  signedAt: z.string().min(1),       // ISO datetime string
  consentText: z.string().min(1),    // the LoA/consent copy user accepted
  artifacts: z.array(ArtifactSchema).optional(),
});

export async function POST(req: Request) {
  try {
    if (!assertAllowed(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const res = await createAuthorization(parsed.data);

    return NextResponse.json({
      ok: true,
      id: res.record.id,
      manifest_hash: res.record.manifest_hash,
      record: res.record,
      files: res.files,
      manifest: res.manifest, // includes .integrity.hashHex (already used to update record)
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    return NextResponse.json({ ok: false, error: "authz_create_failed", note: msg }, { status: 500 });
  }
}

// GET /api/subject/authorization?id=...
export async function GET(req: Request) {
  try {
    if (!assertAllowed(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
    }

    const { record, files } = await getAuthorization(id);
    if (!record) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, record, files });
  } catch (e: any) {
    const msg = String(e?.message || e);
    return NextResponse.json({ ok: false, error: "authz_fetch_failed", note: msg }, { status: 500 });
  }
}
