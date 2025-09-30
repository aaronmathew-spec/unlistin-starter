// app/api/ai/reindex/route.ts
export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = process.env.ADMIN_API_TOKEN;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
  if (!token || bearer !== token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  // Just proxy to the cron endpoint so we keep logic in one place
  const url = new URL(req.url);
  url.pathname = "/api/cron/ai-index";
  const body = await req.text();
  const res = await fetch(url.toString(), {
    method: "POST",
    body,
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
      authorization: `Bearer ${token}`,
    },
  });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
}
