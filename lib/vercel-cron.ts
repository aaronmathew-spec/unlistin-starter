// lib/vercel-cron.ts
/**
 * Guard to ensure the route is called by Vercel Cron (x-vercel-cron: 1)
 * or (optionally) via a Bearer secret you set in Vercel env: CRON_BEARER
 */
export function assertCronAuthorized(req: Request): Response | null {
  // 1) Official Vercel Cron header
  const vv = req.headers.get("x-vercel-cron");
  if (vv === "1") return null;

  // 2) Optional: manual trigger with Bearer token
  const auth = req.headers.get("authorization") || "";
  const expected = process.env.CRON_BEARER;
  if (expected && auth === `Bearer ${expected}`) return null;

  // Not authorized
  return new Response("Forbidden", { status: 403 });
}
