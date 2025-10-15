// lib/pii/redact.ts
/**
 * Minimal PII redaction for safe logs/artifacts.
 * - Email -> local part first/last char only + domain
 * - Phone -> keep last 4 digits
 * - Free text -> naive email/phone masking
 */

const EMAIL_RE = /([a-zA-Z0-9._%+-])([a-zA-Z0-9._%+-]*)([a-zA-Z0-9._%+-])@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
const PHONE_RE = /\b(\+?\d{0,3})?[\s\-\.]?\(?\d{2,4}\)?[\s\-\.]?\d{2,4}[\s\-\.]?\d{3,4}\b/g;

export function maskEmail(input: string): string {
  return input.replace(EMAIL_RE, (_m, a, mid, b, domain) => {
    const middle = mid ? "…" : "";
    return `${a}${middle}${b}@${domain}`;
  });
}

export function maskPhone(input: string): string {
  return input.replace(PHONE_RE, (m) => {
    const digits = m.replace(/\D/g, "");
    if (digits.length < 6) return "xx"; // too short, mask fully
    return `xxxxxx${digits.slice(-4)}`;
  });
}

export function maskFreeText(input: string): string {
  return maskPhone(maskEmail(input));
}

/** Redacts common fields in an object for log safety */
export function redactForLogs<T>(obj: T): T {
  const json = JSON.stringify(obj, (_k, v) => {
    if (typeof v === "string") return maskFreeText(v);
    return v;
  });
  return JSON.parse(json) as T;
}
