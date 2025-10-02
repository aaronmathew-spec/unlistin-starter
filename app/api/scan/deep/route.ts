/* app/api/scan/deep/route.ts */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { queryJustdial } from "@/lib/scan/brokers/justdial";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { normalizeHit, toRedactedInput, type RawHit } from "@/lib/scan/normalize";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

type Body = Partial<{ fullName: string; email: string; city: string }>;

export async function POST(req: Request) {
  // rate limit
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  let body: Body = {};
  try { body = await req.json(); } catch {}

  const fullName = body.fullName?.trim() || "";
  const email = body.email?.trim() || "";
  const city = body.city?.trim() || "";

  if (!fullName && !email && !city) {
    return NextResponse.json({ ok: false, error: "Provide at least one field." }, { status: 400 });
  }

  const t0 = Date.now();
  // 1) Execute adapters in parallel (expand later with more brokers)
  const [jd] = await Promise.all([
    queryJustdial({ fullName, email, city }).catch(() => [] as RawHit[]),
  ]);

  // 2) Normalize & filter by allowlist (defense in depth)
  const raw = [...jd].map(normalizeHit).filter(h => isAllowed(h.url));

  // 3) Persist RUN + HITS (only redacted fields)
  const db = supa();
  const redacted = toRedactedInput({ fullName, email, city });

  // Create run
  const { data: runRow, error: runErr } = await db
    .from("scan_runs")
    .insert({
      // never store raw inputs
      query_preview: redacted, // jsonb
      status: "completed",
      took_ms: Date.now() - t0,
    } as any)
    .select("id")
    .maybeSingle();

  if (runErr || !runRow) {
    // If DB fails, still return results (non-persistent)
    return NextResponse.json({
      ok: true, persisted: false, runId: null,
      results: raw, tookMs: Date.now() - t0,
    });
  }

  // Insert hits
  const rows = raw.slice(0, 20).map((h, i) => ({
    run_id: runRow.id,
    rank: i + 1,
    broker: h.broker,
    category: h.category,
    url: h.url,
    confidence: h.confidence,
    matched_fields: h.matchedFields,
    evidence: h.evidence,
  }));

  await db.from("scan_hits").insert(rows as any).then(() => {}).catch(() => { /* ignore */ });

  return NextResponse.json({
    ok: true, persisted: true,
    runId: runRow.id,
    results: raw,
    tookMs: Date.now() - t0,
  });
}
