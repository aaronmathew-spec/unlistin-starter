export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

function envBool(v?: string) { return v === "1" || v?.toLowerCase() === "true"; }

export async function POST(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_FILE_EXTRACTORS)) {
      return NextResponse.json({ error: "file extractors disabled" }, { status: 503 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
    const buf = Buffer.from(await (file as File).arrayBuffer());

    const pdfMod = await import("pdf-parse");
    const pdf = (pdfMod as any).default ?? (pdfMod as any);
    const out = await pdf(buf);
    return NextResponse.json({ ok: true, text: (out?.text || "").trim() });
  } catch (e) {
    console.error("pdf-to-text error", e);
    return NextResponse.json({ error: "extract failed" }, { status: 500 });
  }
}
