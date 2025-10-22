// app/api/proofs/[subjectId]/export/route.ts
import { NextResponse } from "next/server";
import { buildSignedExport } from "@/lib/proofs/export";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: { subjectId: string } }
) {
  const subjectId = ctx.params.subjectId;
  if (!subjectId) {
    return NextResponse.json({ error: "subjectId required" }, { status: 400 });
  }

  try {
    // Builder returns a Uint8Array that may sit on a SharedArrayBuffer.
    const u8 = await buildSignedExport(subjectId);

    // Make a COPY -> guarantees a fresh ArrayBuffer (not SharedArrayBuffer).
    const copy = new Uint8Array(u8.length);
    copy.set(u8);
    const ab = copy.buffer; // plain ArrayBuffer now

    // Wrap in Blob to satisfy BodyInit types cleanly
    const blob = new Blob([ab], { type: "application/zip" });

    const filename = `unlistin-proof-bundle-${subjectId}.zip`;

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[proofs.export.error]", { subjectId, error: String(e?.message || e) });
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
