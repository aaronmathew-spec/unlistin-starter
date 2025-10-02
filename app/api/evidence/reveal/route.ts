// app/api/evidence/reveal/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

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

export async function POST(req: Request) {
  const db = supa();

  let body: any = {};
  try { body = (await req.json()) ?? {}; } catch {}

  const id = Number(body?.id || 0);
  const reason = (body?.reason || "User-initiated reveal").toString();

  if (!id) return json({ ok: false, error: "Missing id" }, { status: 400 });

  const { data: art, error } = await db
    .from("evidence_artifacts")
    .select("id, key_id, alg, blob_b64, expires_at")
    .eq("id", id)
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, { status: 400 });
  if (!art) return json({ ok: false, error: "Not found" }, { status: 404 });

  if (art.expires_at && new Date(art.expires_at).getTime() < Date.now()) {
    return json({ ok: false, error: "Artifact expired" }, { status: 410 });
  }

  let decrypted: any = null;
  try {
    const packed = JSON.parse(art.blob_b64);
    const { iv_b64, tag_b64, blob_b64 } = packed;
    const crypto = await import("@/lib/evidence");
    decrypted = (crypto as any).decryptJson({ iv_b64, tag_b64, blob_b64 });
  } catch {
    return json({ ok: false, error: "Decrypt failed" }, { status: 500 });
  }

  try {
    await auditReveal({ artifactId: art.id, reason });
  } catch {}

  return json({ ok: true, blob: decrypted, ttlSeconds: 120 });
}
