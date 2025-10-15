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

/**
 * POST /api/scan/quick
 * Body: { fullName?: string; email?: string; city?: string }
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

  // --- Base adapters (present today) ---
  const [jd, sl, im] = await Promise.all([
    queryJustdial({ name: fullName, email, city }).catch(() => [] as RawHit[]),
    querySulekha({ name: fullName, email, city }).catch(() => [] as RawHit[]),
    queryIndiaMart({ name: fullName, email, city }).catch(() => [] as RawHit[]),
  ]);

  // --- Optional adapters (Phase 1): import safely, literal paths only ---
  let queryTruecaller:
    | ((i: { name?: string; email?: string; city?: string }) => Promise<RawHit[]>)
    | null = null;
  let queryNaukri:
    | ((i: { name?: string; email?: string; city?: string }) => Promise<RawHit[]>)
    | null = null;
  let queryOlx:
    | ((i: { name?: string; email?: string; city?: string }) => Promise<RawHit[]>)
    | null = null;
  let queryFoundit:
    | ((i: { name?: string; email?: string; city?: string }) => Promise<RawHit[]>)
    | null = null;
  let queryShine:
    | ((i: { name?: string; email?: string; city?: string }) => Promise<RawHit[]>)
    | null = null;
  let queryTimesJobs:
    | ((i: { name?: string; email?: string; city?: string }) => Promise<RawHit[]>)
    | null = null;

  try {
    const m = await import("@/lib/scan/brokers/truecaller");
    if (m?.queryTruecaller) queryTruecaller = m.queryTruecaller;
  } catch {}
  try {
    const m = await import("@/lib/scan/brokers/naukri");
    if (m?.queryNaukri) queryNaukri = m.queryNaukri;
  } catch {}
  try {
    const m = await import("@/lib/scan/brokers/olx");
    if (m?.queryOlx) queryOlx = m.queryOlx;
  } catch {}
  try {
    const m = await import("@/lib/scan/brokers/foundit");
    if (m?.queryFoundit) queryFoundit = m.queryFoundit;
  } catch {}
  try {
    const m = await import("@/lib/scan/brokers/shine");
    if (m?.queryShine) queryShine = m.queryShine;
  } catch {}
  try {
    const m = await import("@/lib/scan/brokers/timesjobs");
    if (m?.queryTimesJobs) queryTimesJobs = m.queryTimesJobs;
  } catch {}

  const [tc, nk, ox, fd, sh, tj] = await Promise.all([
    queryTruecaller
      ? queryTruecaller({ name: fullName, email, city }).catch(() => [] as RawHit[])
      : Promise.resolve([] as RawHit[]),
    queryNaukri
      ? queryNaukri({ name: fullName, email, city }).catch(() => [] as RawHit[])
      : Promise.resolve([] as RawHit[]),
    queryOlx
      ? queryOlx({ name: fullName, email, city }).catch(() => [] as RawHit[])
      : Promise.resolve([] as RawHit[]),
    queryFoundit
      ? queryFoundit({ name: fullName, email, city }).catch(() => [] as RawHit[])
      : Promise.resolve([] as RawHit[]),
    queryShine
      ? queryShine({ name: fullName, email, city }).catch(() => [] as RawHit[])
      : Promise.resolve([] as RawHit[]),
    queryTimesJobs
      ? queryTimesJobs({ name: fullName, email, city }).catch(() => [] as RawHit[])
      : Promise.resolve([] as RawHit[]),
  ]);

  // Allowlist enforcement (defense in depth)
  const raw = [...jd, ...sl, ...im, ...tc, ...nk, ...ox, ...fd, ...sh, ...tj].filter((h) =>
    isAllowed(h.url)
  );

  // Normalize & rank (server-side region-aware boost via adapter metadata)
  const normalized = normalizeHits(input, raw);

  // Shape the quick-scan result for the UI
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
