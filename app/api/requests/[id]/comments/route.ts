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

// GET /api/requests/:id/comments?cursor=&limit=
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

  // Validate access to request (owner). We rely on requests RLS but this helps return 404 quickly.
  const { data: reqRow } = await supabase
    .from("requests")
    .select("id")
    .eq("id", requestId)
    .single();

  if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let q = supabase
    .from("request_comments")
    .select("id, request_id, user_id, body, is_deleted, created_at, updated_at")
    .eq("request_id", requestId)
    .eq("is_deleted", false)
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

  return NextResponse.json({ comments: rows, nextCursor });
}

// POST /api/requests/:id/comments  { body: string }
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const requestId = Number(params.id);
  if (!requestId) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const supabase = getSSR();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await req.json().catch(() => ({}));
  const body = String(payload?.body ?? "").trim();
  if (!body) return NextResponse.json({ error: "Empty comment" }, { status: 400 });

  // Insert comment
  const { data: inserted, error } = await supabase
    .from("request_comments")
    .insert({ request_id: requestId, body })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Add event
  await supabase.from("request_events").insert({
    request_id: requestId,
    event_type: "comment_added",
    meta: { comment_id: inserted.id },
  });

  return NextResponse.json({ comment: inserted });
}
