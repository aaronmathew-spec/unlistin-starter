/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { redactEmail, redactPhone, normalizeEmail, normalizePhone } from "@/lib/privacy";

export const runtime = "nodejs";

// small helper for deterministic “demo” signals without storing anything
function hashStr(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// build a few indicative targets (India-first + generic)
function candidateSites() {
  return [
    { site: "Truecaller", type: "data_broker", url: "https://www.truecaller.com" },
    { site: "Justdial", type: "data_broker", url: "https://www.justdial.com" },
    { site: "LinkedIn", type: "social", url: "https://www.linkedin.com" },
    { site: "Facebook", type: "social", url: "https://www.facebook.com" },
    { site: "Google Search", type: "search_engine", url: "https://www.google.com" },
    { site: "HaveIBeenPwned", type: "breach", url: "https://haveibeenpwned.com" },
  ] as const;
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
  // rate limit (per IP) using the shared search limiter
  const rl = await ensureSearchLimit(req);
  if (!rl.ok) {
    return json({ error: "Rate limit exceeded. Try again shortly." }, { status: 429 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const name = String(body?.name || "").trim();
  const city = String(body?.city || "").trim();
  const rawEmail = String(body?.email || "").trim();
  const rawPhone = String(body?.phone || "").trim();

  if (name.length < 2) {
    return json({ error: "Please provide your name (2+ chars)" }, { status: 400 });
  }

  // DO NOT STORE anything — we only compute in-memory for the response.
  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  const phone = rawPhone ? normalizePhone(rawPhone) : "";

  const redEmail = email ? redactEmail(email) : "";
  const redPhone = phone ? redactPhone(phone) : "";
  const nameKey = name.toLowerCase() + (city ? `:${city.toLowerCase()}` : "");
  const seed = hashStr(`${nameKey}|${email}|${phone}`);

  // heuristics: select subset with pseudo-random but deterministic confidence
  const sites = candidateSites();
  const matches = sites
    .map((s, idx) => {
      const localSeed = hashStr(seed + ":" + idx);
      // 0..1-ish
      const conf = ((localSeed % 100) / 100) * (email || phone ? 1.0 : 0.75);
      const matchedFields: string[] = ["name"];
      if (city) matchedFields.push("city");
      if (email) matchedFields.push("email");
      if (phone) matchedFields.push("phone");

      // a tiny preview text (redacted)
      const previewParts = [`Name: ${name}`];
      if (city) previewParts.push(`City: ${city}`);
      if (email) previewParts.push(`Email: ${redEmail}`);
      if (phone) previewParts.push(`Phone: ${redPhone}`);

      // cheap entity path for “how to remove” docs you can write later
      const slug = s.site.toLowerCase().replace(/\s+/g, "-");
      return {
        site: s.site,
        type: s.type,
        url: s.url,
        confidence: Math.min(0.98, Math.max(0.15, conf)),
        matched_fields: matchedFields,
        preview: previewParts.join(" · "),
        action: { label: "How to remove", href: `/docs/data-brokers/${slug}` },
      };
    })
    // show higher confidence first
    .sort((a, b) => b.confidence - a.confidence)
    // cap to 8 items for compact UI
    .slice(0, 8);

  return NextResponse.json({ matches }, { status: 200 });
}
