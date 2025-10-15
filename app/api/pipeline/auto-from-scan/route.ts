// app/api/pipeline/auto-from-scan/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { isAllowed } from "@/lib/scan/domains-allowlist";
import { normalizeHits, type ScanInput, type RawHit } from "@/lib/scan/normalize";

// Reuse the same adapters as /api/scan/quick
import { queryJustdial } from "@/lib/scan/brokers/justdial";
import { querySulekha } from "@/lib/scan/brokers/sulekha";
import { queryIndiaMart } from "@/lib/scan/brokers/indiamart";
import { loadControllerMeta } from "@/lib/controllers/store";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

/**
 * POST /api/pipeline/auto-from-scan
 * Body: { fullName?: string; email?: string; city?: string; locale?: "en"|"hi"; limit?: number }
 *
 * - Runs discovery (quick adapters)
 * - Normalizes & ranks
 * - For each hit: if controller.autoDispatchEnabled && confidence >= minConf → auto-dispatch
 * - Returns a summary of attempted/queued dispatches (idempotency is handled by /api/pipeline/auto-dispatch)
 *
 * Secured by x-secure-cron; call from worker/cron or Ops only.
 */
export async function POST(req: Request) {
  if (!OPS_SECRET) return NextResponse.json({ ok: false, error: "SECURE_CRON_SECRET not configured" }, { status: 500 });
  const header = req.headers.get("x-secure-cron") || "";
  if (header !== OPS_SECRET) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
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
  const locale: "en" | "hi" = (body?.locale === "hi" ? "hi" : "en") as "en" | "hi";
  const limit = Number(body?.limit) > 0 ? Math.min(Number(body.limit), 5) : 3; // safety cap

  if (!fullName && !email && !city) {
    return NextResponse.json({ ok: false, error: "Provide at least one of: fullName, email, city." }, { status: 400 });
  }

  const input: ScanInput = {
    name: fullName || undefined,
    email: email || undefined,
    city: city || undefined,
  };

  const t0 = Date.now();

  const [jd, sl, im] = await Promise.all([
    queryJustdial({ name: fullName, email, city }).catch(() => [] as RawHit[]),
    querySulekha({ name: fullName, email, city }).catch(() => [] as RawHit[]),
    queryIndiaMart({ name: fullName, email, city }).catch(() => [] as RawHit[]),
  ]);

  const raw = [...jd, ...sl, ...im].filter((h) => isAllowed(h.url));
  const normalized = normalizeHits(input, raw);

  // Sort by confidence, highest first, then take top-N
  const top = [...normalized].sort((a, b) => b.confidence - a.confidence).slice(0, limit);

  const attempts: Array<{
    controllerKey: string;
    controllerName: string;
    url: string;
    confidence: number;
    threshold: number | null;
    enabled: boolean;
    dispatched: boolean;
    skippedReason?: string;
    response?: any;
  }> = [];

  for (const n of top) {
    const controllerKey = n.broker.toLowerCase(); // normalize like "truecaller", "naukri"
    const meta = (await loadControllerMeta(controllerKey)) || undefined;

    const enabled = !!meta?.autoDispatchEnabled;
    const threshold = typeof meta?.autoDispatchMinConf === "number" ? meta!.autoDispatchMinConf! : null;

    if (!enabled) {
      attempts.push({
        controllerKey,
        controllerName: n.broker,
        url: n.url,
        confidence: n.confidence,
        threshold,
        enabled: false,
        dispatched: false,
        skippedReason: "auto_dispatch_disabled",
      });
      continue;
    }

    if (threshold !== null && n.confidence < threshold) {
      attempts.push({
        controllerKey,
        controllerName: n.broker,
        url: n.url,
        confidence: n.confidence,
        threshold,
        enabled: true,
        dispatched: false,
        skippedReason: "below_threshold",
      });
      continue;
    }

    // Dispatch via internal auto-dispatch endpoint (idempotent + audited)
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/pipeline/auto-dispatch`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-secure-cron": OPS_SECRET,
      },
      body: JSON.stringify({
        controllerKey,
        controllerName: n.broker,
        locale,
        subject: {
          name: fullName || undefined,
          email: email || undefined,
          phone: undefined,
        },
        // optionally pass a known formUrl if you like; else worker will resolve
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    attempts.push({
      controllerKey,
      controllerName: n.broker,
      url: n.url,
      confidence: n.confidence,
      threshold,
      enabled: true,
      dispatched: res.ok && data?.ok === true,
      response: data,
    });
  }

  return NextResponse.json({
    ok: true,
    tookMs: Date.now() - t0,
    evaluated: top.length,
    attempts,
  });
}
