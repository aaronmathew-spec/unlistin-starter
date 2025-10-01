// lib/privacy.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  // keep digits only, strip leading zeros country-agnostic (you can adapt for +91 logic)
  const digits = phone.replace(/\D+/g, "");
  return digits.replace(/^0+/, "");
}

export function sha256Hex(input: string, salt?: string) {
  const h = crypto.createHash("sha256");
  h.update(salt || "");
  h.update(input);
  return h.digest("hex");
}

export function redactEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return "****";
  const u = user.length <= 2 ? user[0] + "*" : user[0] + "*".repeat(user.length - 2) + user[user.length - 1];
  const parts = domain.split(".");
  const d0 = parts[0] ?? "";
  const dRed = d0.length <= 2 ? d0[0] + "*" : d0[0] + "*".repeat(d0.length - 2) + d0[d0.length - 1];
  const rest = parts.slice(1).join(".");
  return `${u}@${dRed}${rest ? "." + rest : ""}`;
}

export function redactPhone(phone: string) {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
}

export function redactName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => (p.length <= 2 ? p[0] + "*" : p[0] + "*".repeat(p.length - 2) + p[p.length - 1]))
    .join(" ");
}
