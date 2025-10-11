import { NextRequest, NextResponse } from "next/server";
import { htmlToText } from "html-to-text";

export const runtime = "nodejs"; // ensure Node (not Edge) for libs

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const html = await file.text();
    const text = htmlToText(html, {
      wordwrap: false,
      selectors: [
        { selector: "script,style,noscript", format: "skip" },
        { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      ],
    });
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    console.error("html-to-text error", e);
    return NextResponse.json({ error: "extract failed" }, { status: 500 });
  }
}
