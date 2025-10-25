// src/lib/email/templates/common.ts
// Small helpers shared by email templates. Keep them framework-agnostic and CSP-safe.

import type { PolicyEntry } from "@/src/lib/policy/dsr";

/**
 * Create a short, jurisdiction-aware header sentence for DSR emails.
 * Falls back to a generic statement when no policy is provided.
 */
export function lawHeader(law: PolicyEntry | null): string {
  if (!law) {
    return "I am exercising my right to erasure under applicable data protection law.";
  }
  // PolicyEntry has `jurisdiction` (human label) and `law` (enum key)
  return `I am exercising my rights under ${law.jurisdiction} (${law.law}) as a data subject.`;
}

/**
 * Join parts with single line breaks, excluding empty/undefined/null values.
 */
export function lineBreaks(...parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim().length > 0)).join("\n");
}

/**
 * Join parts as separate paragraphs (double line breaks).
 */
export function paragraphs(...parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim().length > 0)).join("\n\n");
}

/**
 * Very light normalization for plain-text email pieces: trims, collapses 3+ newlines.
 * (Leave HTML escaping/encoding to the caller/template renderer.)
 */
export function normalizePlain(text: string): string {
  const t = (text || "").trim();
  return t.replace(/\n{3,}/g, "\n\n");
}
