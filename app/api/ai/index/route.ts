export const runtime = "nodejs";

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ensureRateLimit } from "@/lib/rateLimit";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limited = await ensureRateLimit(`ai-index:${ip}`, 10, 10);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests", code: "rate_limited", retryAfter: limited.retryAfter },
      { status: 429, headers: { "retry-after": String(limited.retryAfter) } }
    );
  }

  const db = supa();
  const body = await req.json().catch(() => ({}));
  const kind = (body?.kind ?? "full") as "request" | "file" | "full";
  const id = body?.id as number | undefined;
  const reindexAll = Boolean(body?.reindexAll);

  if (kind !== "full" && (!id || !Number.isFinite(id))) {
    return NextResponse.json({ error: "id required for kind != full" }, { status: 400 });
  }

  // Enqueue
  const jobs = kind === "full"
    ? [{ kind: "full", source_id: null }]
    : [{ kind, source_id: id! }];

  if (reindexAll) {
    // mark as 'full' regardless of kind when reindexAll=true
    jobs[0] = { kind: "full", source_id: null as any };
  }

  const { error } = await db.from("ai_index_queue").insert(
    jobs.map((j) => ({ kind: j.kind, source_id: j.source_id }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ enqueued: jobs.length });
}
