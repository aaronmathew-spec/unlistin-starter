// app/api/scan/quick/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import {
  normalizeHits,
  type ScanInput,
  type RawHit,
} from "@/lib/scan/normalize";
import { queryJustdial } from "@/lib/scan/brokers/justdial";
import { querySulekha } from "@/lib/scan/brokers/sulekha";
import { queryIndiaMart } from "@/lib/scan/brokers/indiamart";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

// Safe helper: dynamic import that returns null on failure
async function maybeImport<T = any>(path: string): Promise<T | null> {
  try {
    // @ts-expect-error: dynamic path may not exist at build-time
    const mod = await import(path);
    return (mod ?? null) as T | null;
  } catch {
    return null;
  }
}

/**
 * POST /api/scan/quick
 * Body: { fullName?: string; email?: string; city?: string }
 *
 * Returns: { ok: true, results: Array<{
 *   broker: string;
 *   category: string;
 *   url: string;
 *   confidence: number; // 0..1
 *   matchedFields: string[];
 *   evidence: string[]; // redacted bullets for UI
 * }>, tookMs: number }
 *
 * Guardrails:
 * - No PII is persisted. Inputs are processed transiently.
 * - Only allowlisted URLs are returned.
 * - Friendly 429s via ensureSearchLimit().
 */
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

  const fullName = (body?.fullName || "").toString().trim();
  const email = (body?.email || "").toString().trim();
  const city = (body?.city || "").toString().trim();

  if (!fullName && !email && !city) {
    return json(
      { ok: false, error: "Provide at least one of: fullName, email, city." },
      { status: 400 }
    );
  }

  const input: ScanInput = {
    name: fullName || undefined,
    email: email || undefined,
    city: city || undefined,
  };

  const t0 = Date.now();

  // Base adapters (present today)
  const [jd, sl, im] = await Promise.all([
    queryJustdial({ name: fullName, email, city }).catch(() => [] as RawHit[]),
    querySulekha({ name: fullName, email, city }).catch(() => [] as RawHit[]),
    queryIndiaMart({ name: fullName, email, city }).catch(() => [] as RawHit[]),
  ]);

  // Optional adapters (Phase 1): will only run if files exist
  const tcMod = await maybeImport<{ queryTruecaller: (i: any) => Promise<RawHit[]> }>("@/lib/scan/brokers/truecaller");
  const nkMod = await maybeImport<{ queryNaukri: (i: any) => Promise<RawHit[]> }>("@/lib/scan/brokers/naukri");
  const oxMod = await maybeImport<{ queryOlx: (i: any) => Promise<RawHit[]> }>("@/lib/scan/brokers/olx");

  const tc = tcMod?.queryTruecaller
    ? await tcMod.queryTruecaller({ name: fullName, email, city }).catch(() => [] as RawHit[])
    : ([] as RawHit[]);
  const nk = nkMod?.queryNaukri
    ? await nkMod.queryNaukri({ name: fullName, email, city }).catch(() => [] as RawHit[])
    : ([] as RawHit[]);
  const ox = oxMod?.queryOlx
    ? await oxMod.queryOlx({ name: fullName, email, city }).catch(() => [] as RawHit[])
    : ([] as RawHit[]);

  // Allowlist enforcement (defense in depth)
  const raw = [...jd, ...sl, ...im, ...tc, ...nk, ...ox].filter((h) => isAllowed(h.url));

  // Normalize & rank (server-side region-aware boost via adapter metadata)
  const normalized = normalizeHits(input, raw);

  // Shape the quick-scan result for the UI
  const results = normalized.map((n) => {
    // Build the evidence array using safe, redacted data only.
    const evidence: string[] = [];

    // Start with “why” bullets provided by the normalizer (already redacted)
    if (Array.isArray(n.why) && n.why.length) {
      evidence.push(...n.why);
    }

    // Add friendly “match” bullets from redacted preview tokens
    if (email && n.preview.email) evidence.push(`Email match ~ ${n.preview.email}`);
    if (fullName && n.preview.name) evidence.push(`Name match ~ ${n.preview.name}`);
    if (city && n.preview.city) evidence.push(`City match ~ ${n.preview.city}`);

    return {
      broker: n.broker,
      category: n.kind ?? "directory",
      url: n.url,
      confidence: n.confidence,
      matchedFields: n.matched ?? [],
      evidence,
    };
  });

  return NextResponse.json({
    ok: true,
    results,
    tookMs: Date.now() - t0,
  });
}
