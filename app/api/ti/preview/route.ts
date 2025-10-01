export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { darkwebPreview } from "@/lib/ti/adapters/darkweb_preview";

/**
 * POST /api/ti/preview
 * Body: { email?: string, phone?: string, username?: string }
 * Returns threat-intel preview hits (no outbound fetch; allowlist enforced).
 */
export async function POST(req: Request) {
  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });

  const body = await req.json().catch(() => ({} as any));
  const email = (body?.email || "").toString().trim();
  const phone = (body?.phone || "").toString().trim();
  const username = (body?.username || "").toString().trim();

  const hits = await darkwebPreview({ email, phone, username });
  return NextResponse.json({ ok: true, hits });
}
