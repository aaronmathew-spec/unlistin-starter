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

// --- Base adapters (present today)
import { queryJustdial } from "@/lib/scan/brokers/justdial";
import { querySulekha } from "@/lib/scan/brokers/sulekha";
import { queryIndiaMart } from "@/lib/scan/brokers/indiamart";

// --- Phase 1 adapters (India-first expansion; all files now exist)
import { queryTruecaller } from "@/lib/scan/brokers/truecaller";
import { queryNaukri } from "@/lib/scan/brokers/naukri";
import { queryOlx } from "@/lib/scan/brokers/olx";
import { queryFoundit } from "@/lib/scan/brokers/foundit";
import { queryShine } from "@/lib/scan/brokers/shine";
import { queryTimesJobs } from "@/lib/scan/brokers/timesjobs";

/** JSON helper (keeps your existing semantics) */
function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/** Adapter registry with stable labels (optional; helps future toggles) */
const ADAPTERS: Array<{
  key: string;
  run: (i: { name?: string; email?: string; city?: string }) => Promise<RawHit[]>;
}> = [
  { key: "justdial", run: queryJustdial },
  { key: "sulekha", run: querySulekha },
  { key: "indiamart", run: queryIndiaMart },

  { key: "truecaller", run: queryTruecaller },
  { key: "naukri", run: queryNaukri },
  { key: "olx", run: queryOlx },
  { key: "foundit", run: queryFoundit },
  { key: "shine", run: queryShine },
  { key: "timesjobs", run: queryTimesJobs },
];

/**
 * POST /api/scan/quick
 * Body: { fullName?: string; email?: string; city?: string }
 *
 * Returns: { ok: true, results: Array<{
 *   broker: string;
 *   category: string;
 *   url: string;
 *   confidence: number;
 *   matchedFields: string[];
 *   evidence: string[];
 * }>, tookMs: number }
 *
 * Guardrails preserved:
 * - Rate limits (429 on exceed)
 * - No persistence of PII; inputs are transient
 * - Allowlist enforced (defense in depth)
 * - Strict normalization & redaction downstream
 */
export async function POST(req: Request) {
  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) {
    return json(
      { ok: false, error: "Rate limit exceeded. Try again shortly." },
      { status: 429 }
    );
  }

  // Parse body safely
  let body: any = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // ignore invalid JSON – handled by validation below
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

  // Fan out to all adapters concurrently with isolation
  const settled = await Promise.allSettled(
    ADAPTERS.map((a) =>
      a
        .run({ name: fullName, email, city })
        .catch(() => [] as RawHit[]) // adapter-level catch for extra safety
    )
  );

  // Gather results, filter by allowlist, and de-duplicate by URL
  const byUrl = new Map<string, RawHit>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const hits = Array.isArray(s.value) ? s.value : [];
    for (const h of hits) {
      if (!h || !h.url || !isAllowed(h.url)) continue;
      // Keep the first occurrence (adapters shouldn't collide, but guard anyway)
      if (!byUrl.has(h.url)) byUrl.set(h.url, h);
    }
  }

  const raw = Array.from(byUrl.values());

  // Normalize & rank (region-aware weights via adapter-meta)
  const normalized = normalizeHits(input, raw);

  // Shape the quick-scan result for the UI (keeps your evidence logic)
  const results = normalized.map((n) => {
    const evidence: string[] = [];

    if (Array.isArray(n.why) && n.why.length) evidence.push(...n.why);
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
