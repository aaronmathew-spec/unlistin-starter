// lib/scan/domains-allowlist.ts
/**
 * Strict allowlist for generating/using evidence URLs in Quick Scan v1.
 * Only domains listed here may appear in results.
 *
 * NOTE: Keep the list conservative. Expand gradually as you curate dossiers.
 */
export const ALLOWLIST = new Set<string>([
  "justdial.com",
  "sulekha.com",
  "indiamart.com",
  "urbanpro.com",
  "shiksha.com",
]);

/** Returns true if a fully-qualified URL's hostname (or its eTLD+1) is allowlisted. */
export function isAllowed(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (ALLOWLIST.has(host)) return true;
    // also allow subdomains of allowlisted roots
    for (const d of ALLOWLIST) {
      if (host === d) return true;
      if (host.endsWith(`.${d}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
