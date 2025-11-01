/* src/lib/crypto/receipts.ts
 * Hashing + artifact receipt helpers for webform job artifacts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || "";

function sb() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Supabase env missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

// ---------- hashing ----------
export function sha256Hex(input: string | Uint8Array | Buffer): string {
  const crypto = require("crypto") as typeof import("crypto");
  const buf =
    typeof input === "string"
      ? Buffer.from(input, "utf-8")
      : Buffer.isBuffer(input)
      ? input
      : Buffer.from(input);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// ---------- decode helpers (reuses your html/screenshot logic patterns) ----------
function toUtf8(value: any): string | null {
  try {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        const maybe = Buffer.from(value, "base64");
        if (maybe.length) {
          return new TextDecoder("utf-8").decode(new Uint8Array(maybe));
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

function parseBase64Image(input: string): { buf: Uint8Array; mime: string } | null {
  if (!input) return null;
  let mime = "image/png";
  let b64 = input.trim();
  const m = /^data:(?<mime>[\w/+.-]+);base64,(?<data>.+)$/i.exec(b64);
  if (m?.groups?.data) {
    b64 = m.groups.data;
    if (m.groups.mime) mime = m.groups.mime;
  }
  try {
    const buf = Buffer.from(b64, "base64");
    if (!buf.length) return null;
    return { buf: Uint8Array.from(buf), mime };
  } catch {
    return null;
  }
}

function extractScreenshot(row: any): Uint8Array | null {
  const raw = row?.artifact_screenshot;
  if (raw) {
    if (Buffer.isBuffer(raw)) return Uint8Array.from(raw as Buffer);
    try {
      const buf = Buffer.from(raw as any);
      return Uint8Array.from(buf);
    } catch {
      /* ignore */
    }
  }
  const result = row?.result || null;
  const b64 =
    result?.screenshotBytesBase64 ??
    result?.screenshot_base64 ??
    result?.screenshot ??
    null;
  if (typeof b64 === "string" && b64) {
    const parsed = parseBase64Image(b64);
    if (parsed) return parsed.buf;
  }
  return null;
}

// ---------- public API ----------
export async function makeArtifactReceipt(jobId: string) {
  const client = sb();

  // Get row with all fields we may need
  const { data, error } = await client
    .from("webform_jobs")
    .select("artifact_html, artifact_screenshot, result")
    .eq("id", jobId)
    .single();

  if (error || !data) {
    return { ok: false as const, error: "job_not_found" };
  }

  // HTML string
  let html: string | null = toUtf8((data as any)?.artifact_html);
  if (!html) {
    const res = (data as any)?.result ?? null;
    const htmlStr: unknown = res?.html;
    if (typeof htmlStr === "string" && htmlStr.length > 0) {
      html = htmlStr;
    } else {
      const htmlB64: unknown = res?.htmlBytesBase64 ?? res?.html_base64;
      if (typeof htmlB64 === "string" && htmlB64.length > 0) {
        try {
          const buf = Buffer.from(htmlB64, "base64");
          html = new TextDecoder("utf-8").decode(new Uint8Array(buf));
        } catch {
          /* ignore */
        }
      }
    }
  }

  // Screenshot bytes
  const screenshotBytes = extractScreenshot(data);

  const html_sha256 =
    html && html.length > 0 ? sha256Hex(html) : null;
  const screenshot_sha256 =
    screenshotBytes && screenshotBytes.byteLength > 0
      ? sha256Hex(screenshotBytes)
      : null;

  // Upsert into receipts
  const { error: upErr } = await client
    .from("ops_artifact_receipts")
    .upsert(
      {
        job_id: jobId,
        html_sha256,
        screenshot_sha256,
      },
      { onConflict: "job_id" }
    );

  if (upErr) {
    return { ok: false as const, error: "receipt_upsert_failed" };
  }

  return {
    ok: true as const,
    job_id: jobId,
    html_sha256,
    screenshot_sha256,
  };
}

export async function verifyArtifactReceipt(jobId: string) {
  const client = sb();

  // Load stored receipt
  const { data: rec, error: recErr } = await client
    .from("ops_artifact_receipts")
    .select("job_id, html_sha256, screenshot_sha256")
    .eq("job_id", jobId)
    .single();

  if (recErr || !rec) {
    return { ok: false as const, error: "receipt_not_found" };
  }

  // Recompute latest hashes
  const fresh = await makeArtifactReceipt(jobId);
  if (!fresh.ok) {
    return { ok: false as const, error: fresh.error };
  }

  const html_ok = (rec.html_sha256 || null) === (fresh.html_sha256 || null);
  const screenshot_ok =
    (rec.screenshot_sha256 || null) === (fresh.screenshot_sha256 || null);

  return {
    ok: html_ok && screenshot_ok,
    html_ok,
    screenshot_ok,
    stored: rec,
    recomputed: {
      html_sha256: fresh.html_sha256,
      screenshot_sha256: fresh.screenshot_sha256,
    },
  };
}
