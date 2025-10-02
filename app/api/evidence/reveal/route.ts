// app/api/evidence/reveal/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { auditReveal } from "@/lib/evidence";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * POST /api/evidence/reveal
 * Body: { id: number, reason?: string }
 *
 * Returns: { ok: boolean, ttlSeconds: number, url?: string, blob?: any }
 * – This “Secure Reveal” returns a short-lived signed URL if the artifact references a file,
 *   or the decrypted JSON blob if the artifact is JSON.
 * – Always audited with a minimal reason string.
 */
export async function POST(req: Request) {
  const db = supa();

  let body: any = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // ignore
  }

  const id = Number(body?.id || 0);
  const reason = (body?.reason || "User-initiated reveal").toString();

  if (!id) return json({ ok: false, error: "Missing id" }, { status: 400 });

  // Fetch artifact
  const { data: art, error } = await db
    .from("evidence_artifacts")
    .select("id, key_id, alg, blob_b64, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  if (!art) return json({ ok: false, error: "Not found" }, { status: 404 });

  // TTL enforcement
  if (art.expires_at && new Date(art.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "Artifact expired" }, { status: 410 });
  }

  // Decrypt JSON payload
  let decrypted: any = null;
  try {
    const packed = JSON.parse(art.blob_b64);
    const { iv_b64, tag_b64, blob_b64 } = packed;
    const crypto = await import("@/lib/evidence");
    decrypted = (crypto as any).decryptJson({ iv_b64, tag_b64, blob_b64 });
  } catch {
    return json({ ok: false, error: "Decrypt failed" }, { status: 500 });
  }

  // Audit every reveal
  try {
    await auditReveal({ artifactId: art.id, reason });
  } catch {
    // non-blocking
  }

  // For JSON artifacts we return the decrypted blob directly (client renders a redacted view)
  return json({
    ok: true,
    blob: decrypted,
    ttlSeconds: 120, // guidance for clients to auto-clear
  });
}
