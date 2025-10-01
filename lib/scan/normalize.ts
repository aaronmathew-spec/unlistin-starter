// lib/scan/normalize.ts
import crypto from "node:crypto";

export type ScanInput = {
  email: string;
  name?: string;
  city?: string;
};

export type RawHit = {
  domain: string;        // normalized host (allowlisted)
  label: string;         // human source label (e.g., "Justdial")
  url: string;           // evidence URL (absolute)
  kind?: "people" | "directory" | "business" | "social" | "public_record";
  // Optional raw fields (not returned directly; we will redact)
  fields?: {
    email?: string;
    name?: string;
    city?: string;
    snippet?: string;
  };
  risk?: "low" | "medium" | "high";
};

export type NormalizedHit = {
  id: string;
  source: string;
  evidence_url: string;
  preview: {
    email?: string;
    name?: string;
    city?: string;
    snippet: string;
    risk: "low" | "medium" | "high";
  };
};

function shaId(...parts: string[]) {
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}

// Basic email redaction: keep first char + domain TLD, mask the rest.
function redactEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "••••@••••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const first = local[0];
  const maskedLocal = `${first}${"•".repeat(Math.max(1, local.length - 1))}`;
  const domainParts = domain.split(".");
  const tld = domainParts.pop();
  const root = domainParts.join(".");
  const maskedDomain =
    (root ? "••••." : "••••") + (tld ? tld : "");
  return `${maskedLocal}@${maskedDomain}`;
}

// Redact a name: keep first letter of each token.
function redactName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (t.length ? `${t[0]}•`.padEnd(Math.min(2, t.length), "•") : "•"))
    .join(" ");
}

// Redact a city: keep first letter, mask rest.
function redactCity(city: string): string {
  if (!city) return "";
  return `${city[0]}${"•".repeat(Math.max(1, city.length - 1))}`;
}

// Redact snippet: replace raw email/name/city occurrences if present.
function redactSnippet(snippet: string, input: ScanInput): string {
  let s = snippet;
  if (input.email) {
    const safe = input.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(safe, "gi"), redactEmail(input.email));
  }
  if (input.name) {
    const safe = input.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(safe, "gi"), redactName(input.name));
  }
  if (input.city) {
    const safe = input.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(safe, "gi"), redactCity(input.city));
  }
  return s;
}

export function normalizeHits(input: ScanInput, hits: RawHit[]): NormalizedHit[] {
  const redactedEmail = redactEmail(input.email);
  const redactedName = input.name ? redactName(input.name) : undefined;
  const redactedCity = input.city ? redactCity(input.city) : undefined;

  return hits.map((h) => {
    const baseSnippet =
      h.fields?.snippet ||
      `Potential listing for ${redactedName || "individual"} on ${h.label}.`;

    const snippet = redactSnippet(baseSnippet, input);

    return {
      id: shaId(h.domain, h.url),
      source: h.label,
      evidence_url: h.url,
      preview: {
        email: redactedEmail,
        name: redactedName,
        city: redactedCity,
        snippet,
        risk: h.risk || "medium",
      },
    };
  });
}
