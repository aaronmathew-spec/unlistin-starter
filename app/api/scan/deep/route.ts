// app/api/scan/deep/route.ts
// NOTE: Paste-replace your existing file with this version to add encrypted artifact storage while preserving current behavior.
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
import { storeEncryptedArtifact } from "@/lib/evidence";

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
  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) {
    return json(
      { ok: false, error: "Rate limit exceeded. Try again shortly." },
      { status: 429 }
    );
  }

  let body: any = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // ignore
  }

  const email = (body?.email || "").toString().trim();
  const name = (body?.name || "").toString().trim();
  const city = (body?.city || "").toString().trim();
  const consent = !!body?.consent;

  if (!email && !name && !city) {
    return json({ ok: false, error: "Provide at least one field." }, { status: 400 });
  }
  if (!consent) {
    return json(
      { ok: false, error: "Consent is required for Deep Scan." },
      { status: 400 }
    );
  }

  const t0 = Date.now();

  // 1) Run adapters concurrently (each gracefully degrades on block)
  const [jd, sl, im] = await Promise.all([
    queryJustdial({ email, name, city }).catch(() => [] as RawHit[]),
    querySulekha({ email, name, city }).catch(() => [] as RawHit[]),
    queryIndiaMart({ email, name, city }).catch(() => [] as RawHit[]),
  ]);

  // 2) Filter by allowlist (defense in depth)
  const raw = [...jd, ...sl, ...im].filter((h) => isAllowed(h.url));

  // 3) Normalize/redact for response using your normalizer
  const previews = normalizeHits({ email, name, city } as ScanInput, raw);

  // 4) Persist run + hits (only redacted previews + evidence URLs)
  const db = supa();

  const { data: run, error: runErr } = await db
    .from("scan_runs")
    .insert({
      status: "completed",
      took_ms: Date.now() - t0,
      // minimal redacted preview of the query
      query_preview: {
        email: previews[0]?.preview?.email ?? (email ? "•@••••" : ""),
        name: previews[0]?.preview?.name ?? (name ? "N•" : ""),
        city: previews[0]?.preview?.city ?? (city ? "C•" : ""),
      },
    })
    .select("id")
    .single();

  if (runErr) {
    return NextResponse.json(
      { ok: false, error: runErr.message },
      { status: 400 }
    );
  }

  // Helper to safely derive a broker label without tightening NormalizedHit
  function deriveBroker(p: any): string {
    const direct = p?.broker ?? p?.label;
    if (typeof direct === "string" && direct.length) return direct;
    try {
      const host = new URL(p?.url || "").hostname;
      if (host) return host.replace(/^www\./, "");
    } catch {
      // ignore
    }
    return "unknown";
  }

  // 5) Insert hits (tolerant to field presence, no type narrowing)
  const rows = (previews as any[]).map((p: any, i: number) => ({
    run_id: run.id,
    rank: i + 1,
    broker: deriveBroker(p),
    category: p?.kind ?? "directory",
    url: p?.url ?? "",
    confidence: Math.round(((p?.confidence ?? 0) as number) * 100) / 100,
    matched_fields: Array.isArray(p?.matched) ? p.matched : [],
    evidence: Array.isArray(p?.why) ? p.why : [], // redacted strings only
  }));

  try {
    await db.from("scan_hits").insert(rows as any);
  } catch {
    // non-fatal
  }

  // 6) Evidence Locker (encrypted artifact): store encrypted JSON “raw snapshot”
  try {
    await storeEncryptedArtifact({
      runId: run.id,
      json: {
        // only include allowlisted URLs + adapter raw fields; PII remains within this encrypted blob
        sources: raw.map((r) => ({
          url: r.url,
          label: (r as any).label ?? null,
          domain: (r as any).domain ?? null,
          kind: (r as any).kind ?? null,
          fields: (r as any).fields ?? null,
        })),
      },
      ttlSeconds: 24 * 3600, // 24h default retention
    });
  } catch {
    // if encryption or storage fails, we still return previews
  }

  return NextResponse.json({
    ok: true,
    persisted: true,
    runId: run.id,
    results: previews,
    tookMs: Date.now() - t0,
  });
}
