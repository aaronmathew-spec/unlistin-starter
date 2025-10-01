/* eslint-disable @typescript-eslint/no-explicit-any */

export const runtime = "nodejs"; // ensure node (libs/edge incompatibilities)
import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { queryAllPreviews } from "@/lib/scan/brokers";
import { normalizeHits, type RawHit } from "@/lib/scan/normalize";

/**
 * This endpoint:
 * - accepts minimal inputs (fullName/email/city)
 * - DOES NOT store any PII (ephemeral only)
 * - returns allowlisted, redacted previews behind your existing UI contract
 * - is rate-limited via ensureSearchLimit
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

function toCategory(kind?: "people" | "directory" | "business" | "social" | "public_record" | "education"): string {
  switch (kind) {
    case "people":
      return "People Search";
    case "business":
      return "Business Directory";
    case "education":
      return "Education / Alumni";
    case "social":
      return "Social";
    case "public_record":
      return "Public Record";
    case "directory":
    default:
      return "Directory Listing";
  }
}

function riskToConfidence(risk: "low" | "medium" | "high"): number {
  if (risk === "high") return 0.9;
  if (risk === "medium") return 0.6;
  return 0.3;
}

export async function POST(req: Request) {
  // Rate limit (IP-aware) — keep your existing contract ({ ok: boolean })
  const rl = await ensureSearchLimit(req);
  if (!rl?.ok) {
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

  // Keep your current validation: at least one field must be present
  if (!fullName && !email && !city) {
    return json({ ok: false, error: "Provide at least one field." }, { status: 400 });
  }

  const t0 = Date.now();

  try {
    // 1) Aggregate candidates from multiple India-first adapters (no network calls; allowlist enforced downstream)
    const candidates = await queryAllPreviews({
      email, // may be empty; safe
      name: fullName || undefined,
      city: city || undefined,
    });

    // 2) Normalize + redact (only previews & allowlisted URLs leave server)
    const raw: RawHit[] = candidates.map((c) => ({
      domain: c.domain,
      label: c.label,
      url: c.url,
      kind: c.kind,
      fields: {
        email,
        name: fullName,
        city,
        snippet: c.fields?.snippet || "",
      },
      risk: c.risk ?? "medium",
    }));

    const normalized = normalizeHits(
      { email, name: fullName || undefined, city: city || undefined },
      raw
    );

    // 3) Map to your existing UI contract (ScanHit[])
    const results: ScanHit[] = normalized.map((n, i) => {
      const src = candidates[i];

      const matchedFields: string[] = [];
      if (fullName) matchedFields.push("name");
      if (email) matchedFields.push("email");
      if (city) matchedFields.push("city");

      const evidence: string[] = [];
      if (n.preview.snippet) evidence.push(n.preview.snippet);
      if (email && n.preview.email) evidence.push(`Email match ~ ${n.preview.email}`);
      if (fullName && n.preview.name) evidence.push(`Name match ~ ${n.preview.name}`);
      if (city && n.preview.city) evidence.push(`City match ~ ${n.preview.city}`);

      return {
        broker: n.source,                // e.g., "Justdial"
        category: toCategory(src?.kind), // stable labels for your UI
        url: n.evidence_url,             // allowlisted URL
        confidence: riskToConfidence(n.preview.risk),
        matchedFields,
        evidence,
      };
    });

    // Confidence sort and cap to top 6 (unchanged UI expectations)
    results.sort((a, b) => b.confidence - a.confidence);
    const top = results.slice(0, 6);

    const tookMs = Date.now() - t0;
    return NextResponse.json({ ok: true, results: top, tookMs });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Scan failed. Please try again." },
      { status: 500 }
    );
  }
}
