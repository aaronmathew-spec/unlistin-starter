import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Adjust this to your table's exact shape if you want stricter typing
type EventRow = {
  id: number;
  request_id: number;
  user_id?: string | null;
  type: string;
  data: unknown | null;
  created_at: string;
};

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
      },
    }
  );
}

/**
 * GET /api/requests/[id]/events?limit=20&cursor=<id>
 * Returns { events, nextCursor }
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const requestId = Number(params.id);
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 20));
    const cursor = url.searchParams.get("cursor");

    const supabase = getSupabase();

    let q = supabase
      .from("request_events") // <-- ensure this matches your table name
      .select("*")
      .eq("request_id", requestId)
      .order("id", { ascending: false })
      .limit(limit);

    if (cursor) {
      // keyset pagination: fetch events with id < cursor
      q = q.lt("id", Number(cursor));
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as EventRow[];

    // ✅ SAFE nextCursor calculation (prevents TS “possibly undefined”)
    const last = rows.length ? rows[rows.length - 1] : undefined;
    const nextCursor =
      rows.length === limit && last?.id != null ? String(last.id) : null;

    return NextResponse.json({ events: rows, nextCursor });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
