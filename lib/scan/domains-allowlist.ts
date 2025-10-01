// lib/scan/domains-allowlist.ts
/**
 * Central allowlist for any URL we are willing to show back to the client
 * (as evidence previews or TI hints). Keep this conservative.
 *
 * Matching rule:
 *  - A URL is allowed if its hostname equals the entry OR ends with ".<entry>"
 *  - Scheme must be http/https
 */

const RAW = [
  // India-first directories / people & business listings (from scan v1)
  "justdial.com",
  "sulekha.com",
  "indiamart.com",
  "urbanpro.com",
  "shiksha.com",

  // Threat-intel preview surfaces (no scraping, public landing pages only)
  "haveibeenpwned.com",
  "intelx.io",
  "leakcheck.io",
  "dehashed.com",

  // (Optionally keep adding curated, safe surfaces here)
] as const;

const DOMAINS = new Set<string>(RAW.map((d) => d.toLowerCase()));

export function isAllowed(urlOrHost: string): boolean {
  try {
    // Accept hostnames directly or full URLs
    let host = urlOrHost;
    if (urlOrHost.includes("://")) {
      const u = new URL(urlOrHost);
      if (u.protocol !== "https:" && u.protocol !== "http:") return false;
      host = u.hostname;
    }
    host = host.toLowerCase();

    // Exact or subdomain-of match
    for (const d of DOMAINS) {
      if (host === d || host.endsWith("." + d)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function listAllowlistedDomains(): string[] {
  return Array.from(DOMAINS.values()).sort();
}
