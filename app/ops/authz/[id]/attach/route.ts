// app/ops/authz/[id]/attach/route.ts
// Accepts multipart/form-data with input name="files" (multiple). Rebuilds manifest hash.

import { NextResponse } from "next/server";
import { attachAuthorizationFiles } from "@/src/lib/authz/store";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const form = await req.formData();
    const files = form.getAll("files");

    const artifacts: Array<{ filename: string; mime: string; base64: string }> = [];

    for (const f of files) {
      if (!(f instanceof File)) continue;
      const arr = new Uint8Array(await f.arrayBuffer());
      artifacts.push({
        filename: f.name || "upload.bin",
        mime: f.type || "application/octet-stream",
        base64: Buffer.from(arr).toString("base64"),
      });
    }

    if (!artifacts.length) {
      return NextResponse.json({ ok: false, error: "no_files" }, { status: 400 });
    }

    const res = await attachAuthorizationFiles(params.id, artifacts);
    if (!res.record) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    // Redirect back to the detail page
    return NextResponse.redirect(new URL(`/ops/authz/${params.id}`, req.url), 302);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
