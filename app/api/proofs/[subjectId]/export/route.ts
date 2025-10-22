// app/api/proofs/[subjectId]/export/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { buildSignedBundle } from "@/lib/proofs/export";

/** Convert Uint8Array -> fresh ArrayBuffer to keep Response/Blob happy in builds. */
function toPlainArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(
  _req: Request,
  { params }: { params: { subjectId: string } }
) {
  try {
    const subjectId = decodeURIComponent(String(params?.subjectId || "")).trim();
    if (!subjectId) return bad(400, "subject_id_required");

    // Build the signed bundle (manifest.json + signature.json + pack.zip)
    const u8 = await buildSignedBundle(subjectId);

    const ab = toPlainArrayBuffer(u8);
    const blob = new Blob([ab], { type: "application/zip" });
    const filename = `unlistin-proof-bundle-${subjectId}.zip`;

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[proofs.export.error]", String(e?.message || e));
    return bad(500, "export_failed");
  }
}
