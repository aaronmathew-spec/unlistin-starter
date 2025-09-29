import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSSR() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return store.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

// GET /api/requests/:id/events?cursor=&limit=
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const requestId = Number(params.id);
  if (!requestId) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  const supabase = getSSR();

  let q = supabase
    .from("request_events")
    .select("id, request_id, user_id, event_type, meta, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) q = q.lt("id", Number(cursor));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = Array.isArray(data) ? data : [];
  const nextCursor =
    rows.length === limit && rows[rows.length - 1]?.id != null
      ? String(rows[rows.length - 1].id)
      : null;

  return NextResponse.json({ events: rows, nextCursor });
}
