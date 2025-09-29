// app/api/requests/[id]/comments/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CommentRow = {
  id: number;
  request_id: number;
  user_id: string;
  body: string;
  created_at: string;
};

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 50)));
  const cursor = searchParams.get("cursor"); // created_at cursor (ISO) or numeric id cursor

  const supabase = createSupabaseServerClient();

  let q = supabase
    .from("request_comments")
    .select("id,request_id,user_id,body,created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    // Support either numeric id or ISO timestamp; use created_at for stability
    const asNum = Number(cursor);
    if (Number.isFinite(asNum)) {
      q = q.lt("id", asNum);
    } else {
      q = q.lt("created_at", cursor);
    }
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []) as CommentRow[];
  const nextCursor = rows.length === limit ? rows.at(-1)?.created_at ?? null : null;

  return NextResponse.json({ comments: rows, nextCursor });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bodyJson = await req.json().catch(() => ({}));
  const { body } = bodyJson || {};
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Body is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("request_comments")
    .insert({
      request_id: requestId,
      user_id: user.id,
      body: body.trim(),
    })
    .select("id,request_id,user_id,body,created_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ comment: data });
}
