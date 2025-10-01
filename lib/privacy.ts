// lib/privacy.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";

/** ---------- Normalizers ---------- */
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  // Keep digits only, strip leading zeros (adapt for +91 formatting separately if you want)
  const digits = phone.replace(/\D+/g, "");
  return digits.replace(/^0+/, "");
}

/** ---------- Hashing ---------- */
export function sha256Hex(input: string, salt?: string) {
  const h = crypto.createHash("sha256");
  if (salt) h.update(salt);
  h.update(input);
  return h.digest("hex");
}

/** ---------- Redaction helpers ---------- */
function maskMiddle(s: string): string {
  if (!s) return "";
  if (s.length <= 2) return s[0] + "*";
  return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
}

function maskDomainLabel(label: string): string {
  if (!label) return "";
  if (label.length <= 2) return label[0] + "*";
  return label[0] + "*".repeat(label.length - 2) + label[label.length - 1];
}

/** example: john.doe@example.com -> j***e@e*****e.com */
export function redactEmail(email: string) {
  const parts = email.split("@");
  const user = parts[0];
  const domain = parts[1];

  if (!user || !domain) return "****";

  const userMasked = maskMiddle(user);

  const domainParts = domain.split(".");
  const firstLabel = domainParts[0] ?? "";
  const restLabels = domainParts.slice(1);
  const maskedFirst = maskDomainLabel(firstLabel);
  const rebuiltDomain = [maskedFirst, ...restLabels].filter(Boolean).join(".");

  return `${userMasked}@${rebuiltDomain || "***"}`;
}

/** keep last 4 digits visible */
export function redactPhone(phone: string) {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

/** mask each token in the name */
export function redactName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return parts.map(maskMiddle).join(" ");
}
