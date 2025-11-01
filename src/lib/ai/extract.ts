/* src/lib/ai/extract.ts */
import "server-only";

export type ExtractResult = {
  ok: true;
  text: string;
  meta: { bytes: number; mime: string; filename?: string | null };
} | {
  ok: false;
  error: string;
  meta?: { bytes?: number; mime?: string; filename?: string | null };
};

function stripHtml(html: string): string {
  // naive but safe for serverless
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function extractTextFromFile(
  buf: Buffer,
  filename?: string | null,
  mime?: string | null
): Promise<ExtractResult> {
  const size = buf.byteLength;
  const lower = (filename || "").toLowerCase();
  const imime = (mime || "").toLowerCase();

  try {
    // Plain text / markdown
    if (imime.startsWith("text/") || /\.(txt|md|csv|log)$/i.test(lower)) {
      return { ok: true, text: buf.toString("utf8"), meta: { bytes: size, mime: imime || "text/plain", filename } };
    }

    // HTML
    if (imime === "text/html" || /\.html?$/i.test(lower)) {
      const html = buf.toString("utf8");
      return { ok: true, text: stripHtml(html), meta: { bytes: size, mime: "text/html", filename } };
    }

    // PDFs / DOCX – require adding a parser; for now, reject with clear 415
    if (imime === "application/pdf" || /\.pdf$/i.test(lower)) {
      return { ok: false, error: "unsupported_pdf_parser_not_installed", meta: { bytes: size, mime: imime || "application/pdf", filename } };
    }
    if (imime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(lower)) {
      return { ok: false, error: "unsupported_docx_parser_not_installed", meta: { bytes: size, mime: imime || "application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename } };
    }

    // Fallback: try UTF-8
    const text = buf.toString("utf8");
    return { ok: true, text, meta: { bytes: size, mime: imime || "application/octet-stream", filename } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e), meta: { bytes: size, mime: imime || "", filename } };
  }
}
