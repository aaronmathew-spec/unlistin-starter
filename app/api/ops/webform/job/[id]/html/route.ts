/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

/** Try to decode a bytea/Buffer-ish value to utf-8 string safely */
function bytesToUtf8(value: any): string | null {
  try {
    if (!value) return null;
    let buf: Buffer;
    if (Buffer.isBuffer(value)) {
      buf = value as Buffer;
    } else if (typeof value === "string") {
      // could be base64 from a trigger—try decode; if fails, return as-is
      try {
        buf = Buffer.from(value, "base64");
      } catch {
        return value;
      }
    } else {
      // Supabase bytea often comes as ArrayBuffer/Uint8Array
      // normalize to Buffer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u8 = value as any;
      if (u8?.buffer) {
        buf = Buffer.from(u8 as Uint8Array);
      } else {
        buf = Buffer.from(String(value));
      }
    }
    return new TextDecoder("utf-8").decode(Uint8Array.from(buf));
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response("env_missing", { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const sb = srv();

  // We try multiple sources, in priority order:
  // 1) artifact_html (bytea/string) column, if present in the table
  // 2) result.html (string) saved by the worker
  // 3) result.htmlBytesBase64 (string base64) saved by the worker
  const { data, error } = await sb
    .from("webform_jobs")
    .select("artifact_html, result")
    .eq("id", id)
    .single();

  if (error) return new Response("not_found", { status: 404 });

  // 1) artifact_html -> utf8 string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artifactHtml: any = (data as any)?.artifact_html ?? null;
  let bodyStr: string | null = bytesToUtf8(artifactHtml);

  // 2) result.html
  if (!bodyStr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (data as any)?.result ?? null;
    const html = res?.html;
    if (typeof html === "string" && html.length > 0) {
      bodyStr = html;
    }
  }

  // 3) result.htmlBytesBase64
  if (!bodyStr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = (data as any)?.result ?? null;
    const htmlB64 = res?.htmlBytesBase64 || res?.html_base64;
    if (typeof htmlB64 === "string" && htmlB64.length > 0) {
      try {
        const buf = Buffer.from(htmlB64, "base64");
        bodyStr = new TextDecoder("utf-8").decode(Uint8Array.from(buf));
      } catch {
        /* ignore */
      }
    }
  }

  if (!bodyStr) return new Response("no_html", { status: 404 });

  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-disposition": `inline; filename="webform-${encodeURIComponent(id)}.html"`,
  };

  // String is a valid BodyInit — no Blob gymnastics needed here
  return new Response(bodyStr, { status: 200, headers });
}
