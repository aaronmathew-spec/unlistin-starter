// src/lib/crypto/hash.ts
import crypto from "crypto";

export function sha256Hex(input: string | Buffer) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function redact(s?: string | null) {
  if (!s) return "";
  // Keep only last 3 characters for display safety
  return s.replace(/.(?=.{0,3}$)/g, "•");
}
