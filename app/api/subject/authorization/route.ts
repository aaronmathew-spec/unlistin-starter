// app/api/subject/authorization/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthorization, getAuthorization } from "@/src/lib/authz/store";

// Optional simple guard (you can tighten this later with a key)
function assertAllowed(req: Request) {
  // Example: only allow POST/GET server-side
  // Optionally check a header like x-internal-key if you want
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
      manifest: res.manifest, // contains integrity.hashHex at minimum
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
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
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
