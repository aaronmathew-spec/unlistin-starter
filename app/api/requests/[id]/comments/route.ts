import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// shape of a comment row in your DB
type CommentRow = {
  id: number;
  request_id: number;
  user_id: string;
  body: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string | null;
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
 * GET /api/requests/[id]/comments?limit=20&cursor=<id>
 * Returns { comments, nextCursor }
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = Number(params.id);
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit")) || 20));
    const cursor = url.searchParams.get("cursor"); // last seen id

    const supabase = getSupabase();

    let q = supabase
      .from("request_comments")
      .select("*")
      .eq("request_id", requestId)
      .eq("is_deleted", false)
      .order("id", { ascending: false })
      .limit(limit);

    if (cursor) {
      // keyset pagination: fetch ids < cursor
      q = q.lt("id", Number(cursor));
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as CommentRow[];

    // ✅ SAFE nextCursor calculation
    const last = rows.length ? rows[rows.length - 1] : undefined;
    const nextCursor =
      rows.length === limit && last?.id != null ? String(last.id) : null;

    return NextResponse.json({ comments: rows, nextCursor });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}

/**
 * POST /api/requests/[id]/comments
 * Body: { body: string }
 * Returns { comment }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = Number(params.id);
    const { body } = (await req.json().catch(() => ({}))) as { body?: string };

    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Comment body is required" }, { status: 400 });
    }

    const supabase = getSupabase();

    // insert comment (RLS enforces the actor)
    const { data, error } = await supabase
      .from("request_comments")
      .insert({ request_id: requestId, body: body.trim() })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ comment: data as CommentRow }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
