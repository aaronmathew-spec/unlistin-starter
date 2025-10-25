// src/lib/crypto/sign.ts
// Minimal signing utility with safe fallbacks.
// Supports SIGNING_BACKEND=local-hmac using SIGNING_SECRET.
// If not configured, returns null signature (callers should handle).

import crypto from "node:crypto";

export type Signature = {
  alg: "HS256";
  keyId: "local-hmac";
  sigHex: string; // hex-encoded HMAC of the payload
};

export function signIfEnabled(payload: unknown): Signature | null {
  const backend = (process.env.SIGNING_BACKEND || "").trim().toLowerCase();
  if (backend !== "local-hmac") return null;

  const secret = process.env.SIGNING_SECRET;
  if (!secret) return null;

  // Stable JSON stringify (sorted keys) to avoid accidental mismatches
  const json = stableStringify(payload);
  const h = crypto.createHmac("sha256", secret);
  h.update(json, "utf8");
  const sigHex = h.digest("hex");
  return { alg: "HS256", keyId: "local-hmac", sigHex };
}

export function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(sorted(obj)).sort());
}

function sorted(value: any): any {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value).sort()) {
      out[k] = sorted(value[k]);
    }
    return out;
  }
  return value;
}
