// app/api/ti/preview/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ensureSearchLimit } from "@/lib/ratelimit";
import { isAllowed } from "@/lib/scan/domains-allowlist";

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

/** ---------- local, conservative masking (no PII persistence; preview-only) ---------- */
function maskEmail(raw: string): string {
  const s = raw.trim();
  const at = s.indexOf("@");
  if (at <= 0) return "•••@•••";
  const user = s.slice(0, at);
  const domain = s.slice(at + 1);
  const uMasked =
    user.length <= 2 ? user[0] + "••" : user.slice(0, 2) + "•••";
  // keep registrable domain hint only (e.g., gmail.com → g•••.com)
  const parts = domain.split(".");
  if (parts.length < 2) return `${uMasked}@${"•••"}`;
  const tld = parts.pop()!;
  const root = parts.pop() || "";
  const rootMasked = root
    ? root[0] + "•••"
    : "•••";
  return `${uMasked}@${rootMasked}.${tld}`;
}

function maskUsernameLike(raw: string): string {
  const s = raw.trim();
  if (!s) return "•••";
  if (s.length <= 2) return s[0] + "•";
  return s[0] + "•••" + s[s.length - 1];
}
/** ------------------------------------------------------------------------------- */

type Hit = {
  source: string;
  domain: string;
  url: string;
  risk: "high" | "medium" | "low";
  note: string; // strictly redacted
};

// allowlisted, consumer-safe hint surfaces (examples only)
// must pass through global allowlist again before returning
const HINT_SOURCES: Array<{ source: string; url: string }> = [
  { source: "HaveIBeenPwned (FAQs)", url: "https://haveibeenpwned.com/FAQs" },
  { source: "Troy Hunt (blog)", url: "https://www.troyhunt.com/" },
  { source: "Mozilla Support", url: "https://support.mozilla.org/" },
];

function deriveRiskFromContext(text: string): "high" | "medium" | "low" {
  const t = text.toLowerCase();
  if (t.includes("credential") || t.includes("password")) return "high";
  if (t.includes("profile") || t.includes("exposure")) return "medium";
  return "low";
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
  const username = (body?.username || "").toString().trim();

  if (!email && !username) {
    return json(
      { ok: false, error: "Provide an email or username for preview hints." },
      { status: 400 }
    );
  }

  const maskedEmail = email ? maskEmail(email) : "";
  const maskedUser = username ? maskUsernameLike(username) : "";

  // Consumer-safe static hints (Deep Scan does real enrichment after consent)
  const base: Hit[] = HINT_SOURCES.map((s) => {
    const domain = safeDomain(s.url);
    const noteParts: string[] = [];
    if (maskedEmail) noteParts.push(`Possible exposure checks for ${maskedEmail}`);
    if (maskedUser) noteParts.push(`Username reuse checks for “${maskedUser}”`);
    const note = noteParts.join(" • ").trim() || "General guidance on exposure checks";
    const risk = deriveRiskFromContext(note);
    return {
      source: s.source,
      domain,
      url: s.url,
      risk,
      note,
    };
  }).filter((h) => isAllowed(h.url));

  return json({ ok: true, hits: base });
}

function safeDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
