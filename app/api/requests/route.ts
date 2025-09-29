// app/api/requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET  /api/requests?limit=20&cursor=123
 *   - Returns the signed-in user's requests (RLS should enforce ownership)
 *   - Sorted by id DESC with cursor pagination on id
 *
 * POST /api/requests
 *   - JSON body: { title: string, description?: string }
 *   - Creates a new request (status defaults to 'open') and logs request_activity 'request_created'
 */

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  const { searchParams } = new URL(req.url);
  const limit = clampInt(searchParams.get("limit"), 20, 1, 100);
  const cursor = searchParams.get("cursor");

  let q = supabase
    .from("requests")
    .select("id, title, status, created_at, updated_at")
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const cursorId = Number(cursor);
    if (!Number.isNaN(cursorId)) q = q.lt("id", cursorId);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const nextCursor =
    data && data.length === limit ? String(data[data.length - 1].id) : null;

  return NextResponse.json({ requests: data ?? [], nextCursor });
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title =
    typeof body.title === "string" ? body.title.trim().slice(0, 200) : null;
  const description =
    typeof body.description === "string"
      ? body.description.trim().slice(0, 5000)
      : null;

  if (!title || title.length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Insert request (RLS should attach to the current user and default status='open')
  const { data: inserted, error } = await supabase
    .from("requests")
    .insert({ title, description })
    .select("id, title, status, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Log activity (best-effort)
  await supabase.from("request_activity").insert({
    request_id: inserted.id,
    type: "request_created",
    message: `Request created: ${inserted.title ?? `#${inserted.id}`}`,
    meta: {
      status: inserted.status,
    },
  });

  return NextResponse.json({ request: inserted }, { status: 201 });
}

/* ----------------------------- helpers ----------------------------- */

function clampInt(
  val: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const n = Number(val);
  if (Number.isFinite(n)) {
    return Math.max(min, Math.min(max, Math.floor(n)));
  }
  return fallback;
}
