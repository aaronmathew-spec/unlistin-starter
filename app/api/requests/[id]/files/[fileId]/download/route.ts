export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/**
 * GET /api/requests/[id]/files/[fileId]/download
 * Returns a redirect to a signed Storage URL (5 min).
 * RLS ensures the caller can only fetch files they own.
 */
export async function GET(
  _req: Request,
  ctx: { params: { id: string; fileId: string } }
) {
  try {
    const requestId = Number(ctx.params.id);
    const fileId = Number(ctx.params.fileId);
    if (!Number.isFinite(requestId) || !Number.isFinite(fileId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = supa();

    // Fetch file row under RLS
    const { data: file, error } = await db
      .from("request_files")
      .select("id, request_id, path, name, mime")
      .eq("id", fileId)
      .eq("request_id", requestId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (!file?.path) {
      return NextResponse.json({ error: "File path missing" }, { status: 400 });
    }

    // Create signed URL (5 minutes)
    const { data: signed, error: signErr } = await db.storage
      .from("request-files")
      .createSignedUrl(file.path, 60 * 5, {
        download: file.name || `file-${file.id}`,
      });

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signErr?.message || "Failed to sign url" },
        { status: 400 }
      );
    }

    // Redirect to signed URL
    return NextResponse.redirect(signed.signedUrl);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
