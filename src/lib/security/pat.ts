// src/lib/security/pat.ts
import crypto from "crypto";

const SALT = (process.env.PAT_HASH_SALT || "unlistin-dev-salt").toString();

export function generatePAT(): { token: string; prefix: string; hash: string } {
  // Token format: uk_live_<12-hex>.<48-hex>
  const pub = crypto.randomBytes(6).toString("hex");   // 12 hex
  const sec = crypto.randomBytes(24).toString("hex");  // 48 hex
  const token = `uk_live_${pub}.${sec}`;

  // Prefix up to the end of the public part for quick lookup
  const prefix = token.slice(0, "uk_live_".length + pub.length);
  const hash = hashPAT(token);
  return { token, prefix, hash };
}

export function hashPAT(token: string): string {
  // scrypt -> hex; deterministic with SALT
  const dk = crypto.scryptSync(token, SALT, 32);
  return dk.toString("hex");
}

/**
 * Parse Bearer token from headers. Returns null when missing/invalid.
 * Accepts Next.js Request or any object exposing Headers.
 */
export function parseBearer(req: Request | { headers: Headers }): string | null {
  const headers = (req as any).headers as Headers;
  const a = headers?.get("authorization");
  const b = headers?.get("Authorization");
  const auth: string | null = a ?? b ?? null; // ensure exact null type

  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token: string | undefined = m?.[1];
  return token ?? null;
}

/** Public lookup prefix from full token */
export function publicPrefixFrom(token: string): string {
  // Everything through the public segment (uk_live_<12-hex>)
  const m = token.match(/^(uk_live_[0-9a-fA-F]{12})\./);
  return m ? m[1] : token.slice(0, "uk_live_".length + 12);
}
