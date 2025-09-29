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
 * GET /api/requests?limit=20&cursor=123&dir=desc
 * - Cursor is the last seen id; returns nextCursor when more.
 * - dir: 'desc' (default) or 'asc'
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 100);
    const dir = (url.searchParams.get("dir") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const cursor = url.searchParams.get("cursor");

    const db = supa();
    let q = db.from("requests").select("id, title, description, status, created_at");

    if (cursor) {
      const c = Number(cursor);
      if (Number.isFinite(c)) {
        // keyset pagination by id
        q = dir === "desc" ? q.lt("id", c) : q.gt("id", c);
      }
    }

    q = q.order("id", { ascending: dir === "asc" }).limit(limit);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as {
      id: number;
      title: string;
      description: string | null;
      status: string;
      created_at: string;
    }[];

    const nextCursor =
      rows.length === limit ? String(rows[rows.length - 1]!.id) : null;

    return NextResponse.json({ requests: rows, nextCursor });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
