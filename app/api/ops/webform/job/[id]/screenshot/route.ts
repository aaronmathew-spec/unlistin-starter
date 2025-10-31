// app/api/ops/webform/job/[id]/screenshot/route.ts
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

/** Parse possible base64 inputs (raw b64 or data URL) and return {buf, mime} */
function parseBase64Image(input: string): { buf: Buffer; mime: string } | null {
  if (!input) return null;
  let mime = "image/png";
  let b64 = input.trim();

  // data URL?
  const m = /^data:(?<mime>[\w/+.-]+);base64,(?<data>.+)$/i.exec(b64);
  if (m?.groups?.data) {
    b64 = m.groups.data;
    if (m.groups.mime) mime = m.groups.mime;
  }

  try {
    const buf = Buffer.from(b64, "base64");
    if (!buf.length) return null;
    return { buf, mime };
  } catch {
    return null;
  }
}

/** Best-effort extraction of screenshot bytes+mime from a row */
function extractScreenshot(row: any): { body: Uint8Array; mime: string } | null {
  // 1) Preferred: bytea column artifact_screenshot
  const raw = row?.artifact_screenshot;
  if (raw) {
    if (Buffer.isBuffer(raw)) {
      return { body: Uint8Array.from(raw as Buffer), mime: "image/png" };
    }
    try {
      const buf = Buffer.from(raw as any);
      return { body: Uint8Array.from(buf), mime: "image/png" };
    } catch {
      // fall through to JSON-based
    }
  }

  // 2) JSON result fields
  const result = row?.result || null;
  const b64 =
    result?.screenshotBytesBase64 ??
    result?.screenshot_base64 ??
    result?.screenshot ??
    null;

  if (typeof b64 === "string" && b64) {
    const parsed = parseBase64Image(b64);
    if (parsed) return { body: Uint8Array.from(parsed.buf), mime: parsed.mime };
  }

  return null;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response("env_missing", { status: 500 });
  }

  const id = (ctx.params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const url = new URL(req.url);
  const asDownload = url.searchParams.get("download") === "1";

  const sb = srv();
  // Select both binary artifact and JSON result to support either storage pattern
  const { data, error } = await sb
    .from("webform_jobs")
    .select("artifact_screenshot, result")
    .eq("id", id)
    .single();

  if (error || !data) return new Response("not_found", { status: 404 });

  const extracted = extractScreenshot(data);
  if (!extracted) return new Response("no_screenshot", { status: 404 });

  const headers: Record<string, string> = {
    "content-type": extracted.mime || "image/png",
    "cache-control": "no-store",
    "content-disposition": asDownload
      ? `attachment; filename="webform-${id}.png"`
      : `inline; filename="webform-${id}.png"`,
  };

  // FIX: wrap bytes in a Blob to satisfy BodyInit typing in Node runtime
  const blob = new Blob([extracted.body], { type: extracted.mime || "image/png" });
  return new Response(blob, { status: 200, headers });
}
