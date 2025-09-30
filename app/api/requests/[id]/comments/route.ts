export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/**
 * GET /api/requests/[id]/comments?limit=&cursor=
 * POST /api/requests/[id]/comments { body: string }
 * Table shape expected: request_comments(id, request_id, body, created_at, user_id?)
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = Number(params.id);
    if (!Number.isFinite(requestId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 100);
    const cursor = url.searchParams.get("cursor");

    const db = supa();
    let q = db
      .from("request_comments")
      .select("id, request_id, body, created_at, user_id")
      .eq("request_id", requestId);

    if (cursor && Number.isFinite(Number(cursor))) {
      q = q.lt("id", Number(cursor));
    }

    q = q.order("id", { ascending: false }).limit(limit);

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data ?? []) as {
      id: number;
      request_id: number;
      body: string;
      created_at: string;
      user_id?: string | null;
    }[];

    const last = rows.length ? rows[rows.length - 1] : null;
    const nextCursor = rows.length === limit && last ? String(last.id) : null;

    return NextResponse.json({ comments: rows, nextCursor });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = Number(params.id);
    if (!Number.isFinite(requestId))
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const { body } = (await req.json().catch(() => ({}))) as { body?: unknown };
    if (typeof body !== "string" || !body.trim()) {
      return NextResponse.json({ error: "Body is required" }, { status: 400 });
    }

    const text = body.trim().slice(0, 5000);

    const db = supa();
    // Get user (optional; works if you've got auth cookies)
    let userId: string | null = null;
    try {
      const { data: u } = await db.auth.getUser();
      userId = u?.user?.id ?? null;
    } catch {
      // ignore
    }

    const { data, error } = await db
      .from("request_comments")
      .insert({ request_id: requestId, body: text, user_id: userId } as any)
      .select("id, request_id, body, created_at, user_id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Best-effort event log
    try {
      await db.from("request_events").insert({
        request_id: requestId,
        type: "comment",
        message: text.slice(0, 280),
      } as any);
    } catch {
      // ignore
    }

    return NextResponse.json({ comment: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
