// src/lib/cron/auth.ts
import crypto from "crypto";

export function requireCronAuth(req: Request, secret = process.env.CRON_SECRET) {
  if (!secret) {
    throw new Error("Missing CRON_SECRET");
  }
  const h = (req.headers.get("x-cron-signature") || "").trim();
  const ts = (req.headers.get("x-cron-timestamp") || "").trim();
  const diffMs = Math.abs(Date.now() - (ts ? Number(ts) : 0));
  if (!h || !ts || Number.isNaN(Number(ts)) || diffMs > 5 * 60 * 1000) {
    return { ok: false as const, reason: "bad headers / timestamp skew" };
  }
  const payload = `${ts}:webform`;
  const mac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(h))) {
    return { ok: false as const, reason: "signature mismatch" };
  }
  return { ok: true as const };
}

/** Helper to create the signature if you trigger locally/scripts */
export function signCron(ts: number, secret = process.env.CRON_SECRET) {
  if (!secret) throw new Error("Missing CRON_SECRET");
  return crypto.createHmac("sha256", secret).update(`${ts}:webform`).digest("hex");
}
