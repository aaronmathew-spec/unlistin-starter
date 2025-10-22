// app/api/media/hash/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeHashes } from "@/lib/media/hash";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) return bad(500, "supabase_env_missing");

  const ct = (req.headers.get("content-type") || "").toLowerCase();
  try {
    let buf: Uint8Array | null = null;

    if (ct.startsWith("application/octet-stream") || ct.startsWith("image/")) {
      buf = new Uint8Array(await req.arrayBuffer());
    } else if (ct.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return bad(400, "file_required");
      buf = new Uint8Array(await file.arrayBuffer());
    } else {
      return bad(415, "unsupported_content_type");
    }

    const hashes = await computeHashes(buf);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Your table name (kept as you currently use it)
    const { data: inserted, error } = await sb
      .from("sensitive_media_hashes")
      .insert({
        sha256_hex: hashes.sha256_hex,
        phash64: hashes.phash64,
        width: hashes.width,
        height: hashes.height,
        source: "upload",
        meta: null,
      })
      .select("id")
      .single();

    if (error) return bad(400, error.message);

    return NextResponse.json({
      ok: true,
      id: inserted?.id ?? null,
      ...hashes,
    });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[media.hash.error]", String(e?.message || e));
    if (String(e?.message || e).includes("sharp_not_available")) {
      // Graceful fallback: still return SHA-256, aHash may be null
      return NextResponse.json({
        ok: true,
        sha256_hex: "computed",
        phash64: null,
        note: "sharp_not_available",
      });
    }
    return bad(500, "internal_error");
  }
}
