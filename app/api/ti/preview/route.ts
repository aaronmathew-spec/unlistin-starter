// app/api/ti/preview/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { darkwebPreview } from "@/lib/ti/adapters/darkweb_preview";
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
 * POST /api/ti/preview
 * Body: { email?: string, phone?: string, username?: string }
 * - Enforces feature flag: feature_flags.deep_check_enabled.enabled === true
 * - Rate limited
 * - No outbound fetch (safe previews only)
 */
export async function POST(req: Request) {
  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });

  // Check feature flag (optional table; treat missing as disabled)
  try {
    const db = supa();
    const { data } = await db.from("feature_flags").select("value").eq("key", "deep_check_enabled").maybeSingle();
    const enabled = Boolean((data?.value as any)?.enabled);
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Feature disabled." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Feature disabled." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  const email = (body?.email || "").toString().trim();
  const phone = (body?.phone || "").toString().trim();
  const username = (body?.username || "").toString().trim();

  if (!email && !phone && !username) {
    return NextResponse.json({ ok: false, error: "Provide at least one field." }, { status: 400 });
  }

  const hits = await darkwebPreview({ email, phone, username });
  return NextResponse.json({ ok: true, hits });
}
