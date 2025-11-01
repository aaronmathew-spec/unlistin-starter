/* app/api/ai/extract/route.ts */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/src/lib/ai/extract";

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.startsWith("multipart/form-data")) {
      return NextResponse.json({ ok: false, error: "expected_multipart" }, { status: 400 });
    }

    const form = await (req as any).formData?.() || await req.formData();
    const file = form.get("file") as unknown as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
    }

    const arrayBuf = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const res = await extractTextFromFile(buf, file.name, file.type);

    if (!res.ok) {
      const status = /unsupported_/.test(res.error) ? 415 : 500;
      return NextResponse.json(res, { status });
    }
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "extract_ready" });
}
