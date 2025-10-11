import { NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const out = await pdf(buf);
    const text = (out.text || "").trim();
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    console.error("pdf-to-text error", e);
    return NextResponse.json({ error: "extract failed" }, { status: 500 });
  }
}
