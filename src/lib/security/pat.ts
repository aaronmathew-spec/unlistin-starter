import crypto from "crypto";

const SALT = (process.env.PAT_HASH_SALT || "unlistin-dev-salt").toString();

export function generatePAT(): { token: string; prefix: string; hash: string } {
  // Token format: uk_live_<12-hex>.<48-hex>
  const pub = crypto.randomBytes(6).toString("hex");   // 12 hex
  const sec = crypto.randomBytes(24).toString("hex");  // 48 hex
  const token = `uk_live_${pub}.${sec}`;
  const prefix = token.slice(0, 12 + "uk_live_".length); // up to pub
  const hash = hashPAT(token);
  return { token, prefix, hash };
}

export function hashPAT(token: string): string {
  // scrypt -> hex; salt from env
  const dk = crypto.scryptSync(token, SALT, 32);
  return dk.toString("hex");
}

export function parseBearer(req: Request | { headers: Headers }): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function publicPrefixFrom(token: string): string {
  return token.slice(0, 12 + "uk_live_".length);
}
