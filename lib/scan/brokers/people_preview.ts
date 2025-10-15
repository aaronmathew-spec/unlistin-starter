// lib/scan/brokers/people_preview.ts
/**
 * Stub adapter: demonstrates structure for India-first people/broker previews.
 * v1 does NOT perform outbound fetch/scrape. It only synthesizes potential,
 * allowlisted evidence URLs deterministically from the input.
 *
 * This keeps the flow server-only, privacy-first, and build-safe on Vercel.
 */
import { isAllowed } from "@/lib/scan/domains-allowlist";

export type PeoplePreviewInput = {
  email: string;
  name?: string;
  city?: string;
  country?: string; // best-effort, from request headers (not required)
};

export type PeoplePreviewHit = {
  domain: string;
  label: string;
  url: string;
  kind: "directory" | "business" | "people";
  fields?: {
    email?: string;
    name?: string;
    city?: string;
    snippet?: string;
  };
  risk?: "low" | "medium" | "high";
};

function labelForDomain(domain: string): string {
  switch (domain) {
    case "justdial.com":
      return "Justdial";
    case "sulekha.com":
      return "Sulekha";
    case "indiamart.com":
      return "IndiaMART";
    case "urbanpro.com":
      return "UrbanPro";
    case "shiksha.com":
      return "Shiksha";

    // Phase 1 additions
    case "truecaller.com":
      return "Truecaller";
    case "naukri.com":
      return "Naukri";
    case "olx.in":
    case "olx.com":
      return "OLX";
    case "foundit.in":
      return "Foundit";
    case "shine.com":
      return "Shine";
    case "timesjobs.com":
      return "TimesJobs";

    default:
      return domain;
  }
}

// Deterministically pick a few allowlisted domains to propose as likely surfaces.
// This is a placeholder for real adapters that will use curated dossiers & search.
function pickCandidateDomains(seed: string): string[] {
  const domains = [
    "justdial.com",
    "sulekha.com",
    "indiamart.com",
    "urbanpro.com",
    "shiksha.com",

    // Phase 1 additions
    "truecaller.com",
    "naukri.com",
    "olx.in",
    "foundit.in",
    "shine.com",
    "timesjobs.com",
  ];

  // simple hash to spread selection
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

  const out = new Set<string>();
  for (let i = 0; i < domains.length; i++) {
    const idx = (h + i * 97) % domains.length;
    const candidate = domains[idx];
    if (typeof candidate === "string") {
      out.add(candidate);
    }
    if (out.size >= 3) break; // cap v1 to 3 suggestions
  }
  return Array.from(out);
}

export async function queryPeoplePreview(input: PeoplePreviewInput): Promise<PeoplePreviewHit[]> {
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim();
  const city = input.city?.trim();

  // Synthesize potential evidence URLs (no network calls).
  const seeds = pickCandidateDomains(email + (name || "") + (city || ""));

  const results: PeoplePreviewHit[] = [];
  for (const domain of seeds) {
    const pathParts: string[] = [];
    if (city) pathParts.push(encodeURIComponent(city));
    if (name) pathParts.push(encodeURIComponent(name.replace(/\s+/g, "-")));
    const path = pathParts.length ? `/${pathParts.join("/")}` : "";

    // Imagined public-facing listing pattern per site (safe guess, not fetched).
    const url = `https://${domain}${path}?ref=unlistin-preview`;

    if (!isAllowed(url)) continue;

    results.push({
      domain,
      label: labelForDomain(domain),
      url,
      kind: "directory",
      fields: {
        email, // will be REDACTED by normalize.ts before returning to client
        name,
        city,
        snippet:
          name && city
            ? `${name} possibly listed in ${city} on ${labelForDomain(domain)}.`
            : `Possible listing on ${labelForDomain(domain)}.`,
      },
      // conservative default; will evolve per-site once dossiers exist
      risk: "medium",
    });
  }

  return results;
}
