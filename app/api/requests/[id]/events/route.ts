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
 * GET /api/requests/[id]/events?limit=&cursor=
 * Rows ordered by id DESC by default (newest first), keyset by id.
 * Table shape expected: request_events(id, request_id, type, message, created_at)
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
      .from("request_events")
      .select("id, request_id, type, message, created_at")
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
      type: string | null;
      message: string | null;
      created_at: string;
    }[];

    const last = rows.length ? rows[rows.length - 1] : null;
    const nextCursor = rows.length === limit && last ? String(last.id) : null;

    return NextResponse.json({ events: rows, nextCursor });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
