// app/ops/authz/[id]/attach/route.ts
// Attach evidence to an authorization and recompute its manifest hash.
// Uses the shared store helper to keep logic in one place.

import { NextResponse, type NextRequest } from "next/server";
import { attachAuthorizationEvidence } from "@/src/lib/authz/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) {
      return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
    }

    // Parse multipart form (field name: "files")
    const form = await req.formData();
    const files = form.getAll("files").filter(Boolean) as File[];
    if (!files.length) {
      // Nothing to do — just bounce back
      return NextResponse.redirect(new URL(`/ops/authz/${id}`, req.url), 303);
    }

    // Convert to the store helper's expected shape
    const uploads = await Promise.all(
      files.map(async (f) => ({
        filename: f.name || "evidence",
        mime: f.type || "application/octet-stream",
        bytes: new Uint8Array(await f.arrayBuffer()),
      })),
    );

    // Persist + recompute manifest hash
    await attachAuthorizationEvidence({ id, uploads });

    // Redirect back to the detail page
    return NextResponse.redirect(new URL(`/ops/authz/${id}`, req.url), 303);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
