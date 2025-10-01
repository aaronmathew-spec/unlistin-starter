/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs"; // ensure node (libs/edge incompatibilities)
import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";

/**
 * This endpoint:
 * - accepts minimal inputs (fullName/email/city)
 * - DOES NOT store any PII (ephemeral only)
 * - returns demo matches so the UI can ship now
 * - is rate-limited via ensureSearchLimit
 *
 * Wire-up plan (later):
 * - connect to real detectors, search APIs, and broker scrapers
 * - return real evidence snippets, canonicalized profiles, etc.
 */

type Body = Partial<{
  fullName: string;
  email: string;
  city: string;
}>;

type ScanHit = {
  broker: string;
  category: string;
  url: string;
  confidence: number; // 0..1
  matchedFields: string[];
  evidence: string[];
};

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
  // Rate limit (IP-aware)
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    return json(
      { ok: false, error: "Rate limit exceeded. Try again shortly." },
      { status: 429 }
    );
  }

  // Parse body (best-effort)
  let body: Body = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    // ignore
  }

  // Normalize (but do not persist)
  const fullName = body.fullName?.trim() || "";
  const email = body.email?.trim() || "";
  const city = body.city?.trim() || "";

  if (!fullName && !email && !city) {
    return json({ ok: false, error: "Provide at least one field." }, { status: 400 });
  }

  const t0 = Date.now();

  // ---- DEMO RESULTS (replace with real detectors later) ----
  const demo: ScanHit[] = [];

  // A few India-centric sample brokers/categories
  const pool: ScanHit[] = [
    {
      broker: "TrueLocal Profiles",
      category: "Business Listing / People",
      url: "https://truelocal.example/profile/preview",
      confidence: 0.78,
      matchedFields: [],
      evidence: [],
    },
    {
      broker: "BharatPeople Finder",
      category: "People Search",
      url: "https://bharatpeople.example/search",
      confidence: 0.62,
      matchedFields: [],
      evidence: [],
    },
    {
      broker: "Mall Directory India",
      category: "Marketing / Directory",
      url: "https://malls.example/records",
      confidence: 0.52,
      matchedFields: [],
      evidence: [],
    },
    {
      broker: "PhoneLead India",
      category: "Lead Aggregator",
      url: "https://phonelead.example/lookup",
      confidence: 0.44,
      matchedFields: [],
      evidence: [],
    },
  ];

  // Light synthetic scoring: bump confidence when fields present
  for (const p of pool) {
    const matched: string[] = [];
    let conf = p.confidence;

    if (fullName) {
      matched.push("name");
      conf += 0.08;
    }
    if (email) {
      matched.push("email");
      conf += 0.06;
    }
    if (city) {
      matched.push("city");
      conf += 0.04;
    }

    // Clip bounds
    conf = Math.min(0.97, Math.max(0.2, conf));

    demo.push({
      ...p,
      confidence: conf,
      matchedFields: matched,
      evidence: synthEvidence(fullName, email, city),
    });
  }

  // Sort by confidence desc and keep top 6
  demo.sort((a, b) => b.confidence - a.confidence);
  const results = demo.slice(0, 6);

  const tookMs = Date.now() - t0;
  return NextResponse.json({ ok: true, results, tookMs });
}

function synthEvidence(fullName?: string, email?: string, city?: string) {
  const e: string[] = [];
  if (fullName) e.push(`Name match: “…${fullName.split(" ")[0]}…”`);
  if (email) e.push(`Email pattern suggests public listing for “…${email.split("@")[0]}…”`);
  if (city) e.push(`Location cue near “…${city.split(",")[0]}…”`);
  return e;
}
