// src/lib/guards/secure-cron.ts
export function assertSecureCron(req: Request) {
  const need = process.env.SECURE_CRON_SECRET;
  if (!need) {
    // If not configured, fail CLOSED to avoid accidental exposure.
    throw new Error("secure_cron_not_configured");
  }
  const got = req.headers.get("x-secure-cron") || req.headers.get("x-secure-cron-secret");
  if (!got || got !== need) {
    throw new Error("forbidden_secure_cron");
  }
}
