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

    const html = await (file as File).text();
    const h2t = await import("html-to-text");
    const htmlToText = (h2t as any).htmlToText ?? (h2t as any).default?.htmlToText ?? (h2t as any).default;
    const text = htmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: "script,style,noscript", format: "skip" },
        { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      ],
    });
    return NextResponse.json({ ok: true, text: (text || "").trim() });
  } catch (e) {
    console.error("html-to-text error", e);
    return NextResponse.json({ error: "extract failed" }, { status: 500 });
  }
}
