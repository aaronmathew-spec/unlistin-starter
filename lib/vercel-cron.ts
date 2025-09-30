// lib/vercel-cron.ts
/**
 * Allows only Vercel Cron to call a route.
 * Vercel Cron sends:  x-vercel-cron: 1
 */
export function assertVercelCron(req: Request): Response | null {
  const h = req.headers.get("x-vercel-cron");
  if (h !== "1") {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}
