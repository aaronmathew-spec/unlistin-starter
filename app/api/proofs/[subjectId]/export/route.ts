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
    const zip = await buildSignedExport(subjectId);
    const filename = `unlistin-proof-bundle-${subjectId}.zip`;

    return new Response(zip, {
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
