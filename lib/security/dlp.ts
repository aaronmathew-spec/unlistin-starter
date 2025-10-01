// lib/security/dlp.ts
/**
 * DLP & redaction utilities for Unlistin.
 * No PII persists; use these to sanitize inbound/outbound text.
 */

import { isAllowed } from "@/lib/scan/domains-allowlist";

export type DlpFinding =
  | { type: "email"; match: string }
  | { type: "phone"; match: string }
  | { type: "aadhaar"; match: string }
  | { type: "pan"; match: string };

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
// India-leaning phone (7–13 digits, allows separators)
const PHONE_RE = /\b(?:\+?91[\s-]?)?(?:\d[\s-]?){7,13}\b/g;
// Aadhaar: 12 digits (reject obvious 0000 blocks; allow spaces)
const AADHAAR_RE = /\b(?!0{4})(\d{4})[\s-]?(?!0{4})(\d{4})[\s-]?(?!0{4})(\d{4})\b/g;
// PAN: 5 letters + 4 digits + 1 letter
const PAN_RE = /\b([A-Z]{5}[0-9]{4}[A-Z])\b/g;

export function findPII(text: string): DlpFinding[] {
  const out: DlpFinding[] = [];
  for (const m of text.matchAll(EMAIL_RE)) out.push({ type: "email", match: m[0] });
  for (const m of text.matchAll(PHONE_RE)) {
    // Filter very short pure sequences like "1234567" embedded in other tokens is okay already via \b
    out.push({ type: "phone", match: m[0] });
  }
  for (const m of text.matchAll(AADHAAR_RE)) out.push({ type: "aadhaar", match: m[0] });
  for (const m of text.matchAll(PAN_RE)) out.push({ type: "pan", match: m[0] });
  return out;
}

function maskEmail(v: string): string {
  const [local, domain] = v.split("@");
  if (!domain) return "••••@••••";
  const first = local[0] ?? "•";
  const maskedLocal = first + "•".repeat(Math.max(1, local.length - 1));
  const parts = domain.split(".");
  const tld = parts.pop() ?? "";
  return `${maskedLocal}@••••.${tld}`;
}
function maskDigits(v: string): string {
  return v.replace(/\d/g, "•");
}
function maskAadhaar(v: string): string {
  return v.replace(/\d/g, "•");
}
function maskPan(v: string): string {
  return v.replace(/[A-Z]/g, "•").replace(/\d/g, "•");
}

/** Redacts common PII patterns in arbitrary text. */
export function redactText(text: string): string {
  return text
    .replace(EMAIL_RE, (m) => maskEmail(m))
    .replace(AADHAAR_RE, (m) => maskAadhaar(m))
    .replace(PAN_RE, (m) => maskPan(m))
    .replace(PHONE_RE, (m) => maskDigits(m));
}

/** Guard a broker/url pair before tool execution. */
export function sanitizeUrlForTool(url: string): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const u = new URL(url);
    if (!isAllowed(u.toString())) {
      return { ok: false, error: "Evidence URL is not on the allowlist." };
    }
    return { ok: true, url: u.toString() };
  } catch {
    return { ok: false, error: "Invalid URL." };
  }
}

/** Generic cooling-off helper (e.g., after repeated failures). No-op stub for now. */
export async function shouldCoolOff(_key: string): Promise<boolean> {
  return false;
}
