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

/** Best-effort decode of bytea/Buffer/ArrayBuffer/base64 -> utf8 string */
function toUtf8(value: any): string | null {
  try {
    if (!value) return null;

    if (typeof value === "string") {
      try {
        const buf = Buffer.from(value, "base64");
        if (buf.length) {
          return new TextDecoder("utf-8").decode(new Uint8Array(buf));
        }
      } catch {
        /* ignore */
      }
      return value;
    }

    if (Buffer.isBuffer(value)) {
      return new TextDecoder("utf-8").decode(new Uint8Array(value));
    }
    if ((value as any)?.buffer) {
      const u8 = value instanceof Uint8Array ? value : new Uint8Array(value);
      return new TextDecoder("utf-8").decode(u8);
    }

    return String(value);
  } catch {
    return null;
  }
}

function htmlResponse(id: string, html: string, asDownload: boolean) {
  const headers: HeadersInit = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-disposition": asDownload
      ? `attachment; filename="webform-${encodeURIComponent(id)}.html"`
      : `inline; filename="webform-${encodeURIComponent(id)}.html"`,
  };
  return new Response(html, { status: 200, headers });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response("env_missing", { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const url = new URL(req.url);
  const asDownload = url.searchParams.get("download") === "1";

  const sb = srv();

  // Attempt #1: query with artifact_html (newer schema)
  let row: any | null = null;
  let hadColumnError = false;

  {
    const { data, error } = await sb
      .from("webform_jobs")
      .select("artifact_html, result")
      .eq("id", id)
      .single();

    if (error) {
      if (
        (error as any)?.code === "PGRST102" ||
        /column .* does not exist/i.test(error.message) ||
        error.message.includes("unknown")
      ) {
        hadColumnError = true;
      } else {
        return new Response("not_found", { status: 404 });
      }
    } else {
      row = data;
    }
  }

  // Attempt #2: older schema without artifact_html -> fetch only result
  if (!row && hadColumnError) {
    const { data, error } = await sb
      .from("webform_jobs")
      .select("result")
      .eq("id", id)
      .single();
    if (error || !data) return new Response("not_found", { status: 404 });
    row = data;
  }

  // 1) Prefer artifact_html if present (and decodable)
  const artifactHtml = toUtf8(row?.artifact_html);
  if (artifactHtml && artifactHtml.length > 0) {
    return htmlResponse(id, artifactHtml, asDownload);
  }

  // 2) Try result.html (string)
  const res = row?.result ?? null;
  const htmlStr: unknown = res?.html;
  if (typeof htmlStr === "string" && htmlStr.length > 0) {
    return htmlResponse(id, htmlStr, asDownload);
  }

  // 3) Try result.htmlBytesBase64 / html_base64
  const htmlB64: unknown = (res as any)?.htmlBytesBase64 ?? (res as any)?.html_base64;
  if (typeof htmlB64 === "string" && htmlB64.length > 0) {
    try {
      const buf = Buffer.from(htmlB64, "base64");
      const text = new TextDecoder("utf-8").decode(new Uint8Array(buf));
      if (text) return htmlResponse(id, text, asDownload);
    } catch {
      /* ignore */
    }
  }

  return new Response("no_html", { status: 404 });
}
