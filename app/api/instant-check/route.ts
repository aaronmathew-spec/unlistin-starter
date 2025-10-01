/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import {
  normalizeEmail,
  normalizePhone,
  sha256Hex,
  redactEmail,
  redactPhone,
  redactName,
} from "@/lib/privacy";

/**
 * This endpoint performs a quick, *stateless* scan.
 * - It DOES NOT write to the database.
 * - It hashes sensitive selectors (email/phone) before using them in lookups.
 * - It returns redacted matches so the user sees proof without exposing raw PII.
 *
 * Environment:
 * - HASH_SALT (optional but recommended) to salt hashes used for lookups.
 * - FEATURE_INSTANT_CHECK=1 to enable this endpoint (optional guard).
 */
function json(data: any, init?: ResponseInit) {
  return new NextResponse(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

type InstantCheckBody = {
  name?: string;
  city?: string;
  email?: string;
  phone?: string;
  region?: "IN" | "GLOBAL";
};

type Match = {
  broker: string;
  category: string;
  confidence: number; // 0..1
  selectors: {
    name?: string;        // redacted
    email_hash?: string;  // sha256 hex (salted)
    phone_hash?: string;  // sha256 hex (salted)
    city?: string;        // as provided (non-PII context)
  };
  preview: string;        // short redacted snippet
};

export async function POST(req: Request) {
  // Feature flag (optional): disable if not ready
  if ((process.env.FEATURE_INSTANT_CHECK || "1") !== "1") {
    return json({ error: "Instant check is disabled" }, { status: 503 });
  }

  // Rate limit (per IP)
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    return json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  let body: InstantCheckBody | undefined;
  try {
    body = (await req.json()) as InstantCheckBody;
  } catch {
    // no-op
  }
  body ||= {};

  const name = (body.name || "").trim();
  const city = (body.city || "").trim();
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();
  const region = body.region === "GLOBAL" ? "GLOBAL" : "IN";

  // Require minimal input: either (name+city) OR email OR phone
  const hasNameCity = !!name && !!city;
  const hasEmail = !!email;
  const hasPhone = !!phone;

  if (!hasNameCity && !hasEmail && !hasPhone) {
    return json(
      { error: "Provide either (name + city) OR email OR phone for a quick check." },
      { status: 400 }
    );
  }

  // Prepare hashed selectors — never log or persist raw email/phone
  const salt = process.env.HASH_SALT || "";
  const emailHash = hasEmail ? sha256Hex(normalizeEmail(email), salt) : undefined;
  const phoneHash = hasPhone ? sha256Hex(normalizePhone(phone), salt) : undefined;

  // ====== BROKER LOOKUPS ======
  // This is a stub to keep the build green and respect privacy.
  // Replace with real per-broker recipes (search pages, APIs, etc).
  // IMPORTANT: Use emailHash/phoneHash where possible. If raw selectors are
  // temporarily required for a specific site, do not store; only keep in-memory
  // for the transit of that single request (and prefer headless browser with local-only state).

  const redactedName = name ? redactName(name) : undefined;
  const redactedEmail = hasEmail ? redactEmail(email) : undefined;
  const redactedPhone = hasPhone ? redactPhone(phone) : undefined;

  // Demo matches to prove UX end-to-end (replace with real results)
  const demo: Match[] = [
    hasNameCity
      ? {
          broker: region === "IN" ? "PeopleFinder.IN" : "PeopleFinder.Global",
          category: "People Directory",
          confidence: 0.78,
          selectors: {
            name: redactedName!,
            city,
          },
          preview: `${redactedName} found in ${city} listing (partial profile)`,
        }
      : undefined,
    hasEmail
      ? {
          broker: "AdAudienceHub",
          category: "AdTech",
          confidence: 0.64,
          selectors: {
            email_hash: emailHash!,
            city: city || undefined,
          },
          preview: `Marketing profile tied to ${redactedEmail} (hashed lookup)`,
        }
      : undefined,
    hasPhone
      ? {
          broker: "LeadGenBuzz",
          category: "Lead Broker",
          confidence: 0.72,
          selectors: {
            phone_hash: phoneHash!,
            city: city || undefined,
          },
          preview: `Lead record referencing ${redactedPhone} (hashed lookup)`,
        }
      : undefined,
  ].filter(Boolean) as Match[];

  // No DB writes. No PII returned (only redactions + hashes).
  return json({ region, matches: demo, notice: "No data stored. Results are ephemeral." });
}
