export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ensureRateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  const rid = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// New helper signature: (req, name, limit, windowMs).
// 20 requests per 10 seconds for downloads:
const limit = await ensureRateLimit(req, "download", 20, 10_000);

if (!limit.ok) {
  // our limiter returns a UNIX seconds 'reset';
  // convert to Retry-After seconds for response payload (optional)
  const nowSec = Math.floor(Date.now() / 1000);
  const retryAfter = Math.max(0, limit.reset - nowSec);

  return NextResponse.json(
    { error: "Too many downloads, slow down.", code: "rate_limited", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

  try {
    const requestId = Number(params.id);
    const fileId = Number(params.fileId);
    if (!Number.isFinite(requestId) || !Number.isFinite(fileId)) {
      return NextResponse.json({ error: "Invalid ids" }, { status: 400 });
    }

    const db = supa();

    // Verify the file belongs to the request and current user can see it (RLS on tables)
    const { data: rf, error } = await db
      .from("request_files")
      .select("id, request_id, path, name, mime, size_bytes")
      .eq("id", fileId)
      .eq("request_id", requestId)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!rf) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Issue a signed URL (policy allows select if owner)
    const { data: signed, error: suErr } = await db.storage
      .from("request-files")
      .createSignedUrl(rf.path, 60); // 60 seconds

    if (suErr || !signed?.signedUrl) {
      logger.error("signed-url-failed", { rid, fileId, err: suErr?.message });
      return NextResponse.json({ error: "Could not issue signed URL" }, { status: 400 });
    }

    // Force a safe download filename
    const filename = (rf.name ?? "file").replace(/[^a-zA-Z0-9._-]/g, "_");

    // Redirect to the signed URL so browser streams from storage
    const res = NextResponse.redirect(signed.signedUrl, 302);
    res.headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    return res;
  } catch (e: any) {
    logger.error("download-exception", { rid, err: e?.message });
    return NextResponse.json({ error: e?.message ?? "Unexpected error" }, { status: 500 });
  }
}
