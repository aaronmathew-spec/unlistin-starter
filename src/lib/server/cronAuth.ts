// src/lib/server/cronAuth.ts
export function assertCronAuth(req: Request) {
  const header = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || !header || header !== expected) {
    const err = new Error("Unauthorized: invalid cron secret");
    (err as any).status = 401;
    throw err;
  }
}
