// app/api/scan/deep/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { normalizeHits, type ScanInput, type RawHit } from "@/lib/scan/normalize";
import { queryJustdial } from "@/lib/scan/brokers/justdial";
import { querySulekha } from "@/lib/scan/brokers/sulekha";
import { queryIndiaMart } from "@/lib/scan/brokers/indiamart";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function POST(req: Request) {
  // Rate limit
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  // Parse input
  let body: Partial<ScanInput> = {};
  try { body = (await req.json()) ?? {}; } catch {}
  const email = (body.email ?? "").trim();
  const name = (body.name ?? "").trim();
  const city = (body.city ?? "").trim();

  if (!email && !name && !city) {
    return NextResponse.json({ ok: false, error: "Provide at least one field." }, { status: 400 });
  }

  const t0 = Date.now();

  // 1) Run adapters concurrently (each gracefully degrades on block)
  const [jd, sl, im] = await Promise.all([
    queryJustdial({ email, name, city }).catch(() => [] as RawHit[]),
    querySulekha({ email, name, city }).catch(() => [] as RawHit[]),
    queryIndiaMart({ email, name, city }).catch(() => [] as RawHit[]),
  ]);

  // 2) Filter by allowlist (defense in depth)
  const raw = [...jd, ...sl, ...im].filter(h => isAllowed(h.url));

  // 3) Normalize/redact for response using YOUR normalizer
  const previews = normalizeHits(
    { email, name, city } as ScanInput,
    raw
  );

  // 4) Persist run + hits (only redacted previews + evidence URLs)
  const db = supa();

  const { data: run, error: runErr } = await db
    .from("scan_runs")
    .insert({
      status: "completed",
      took_ms: Date.now() - t0,
      // Store only a minimal redacted preview of the query
      query_preview: {
        email: previews[0]?.preview.email ?? (email ? "•@••••" : ""),
        name: previews[0]?.preview.name ?? (name ? "N•" : ""),
        city: previews[0]?.preview.city ?? (city ? "C•" : ""),
      },
    } as any)
    .select("id")
    .maybeSingle();

  if (!run || runErr) {
    // If DB fails, still return response
    return NextResponse.json({
      ok: true,
      persisted: false,
      runId: null,
      results: previews,
      tookMs: Date.now() - t0,
    });
  }

  const rows = raw.slice(0, 30).map((h, i) => ({
    run_id: run.id,
    rank: i + 1,
    broker: h.label,              // store human label for back-compat
    category: h.kind ?? "directory",
    url: h.url,                   // allowlisted already
    confidence: 0.7,              // v1: static; can compute from heuristics later
    matched_fields: [
      ...(name ? ["name"] : []),
      ...(email ? ["email"] : []),
      ...(city ? ["city"] : []),
    ],
    evidence: [h.fields?.snippet ?? ""].filter(Boolean),
  }));

  try {
    await db.from("scan_hits").insert(rows as any);
  } catch {
    // ignore; run exists so results page still loads
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    runId: run.id,
    results: previews,
    tookMs: Date.now() - t0,
  });
}
