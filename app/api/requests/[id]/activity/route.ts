// app/api/requests/[id]/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);

  const { searchParams } = new URL(req.url);
  const limit = clampInt(searchParams.get("limit"), 20, 1, 100);
  const cursor = searchParams.get("cursor");

  let q = supabase
    .from("request_activity")
    .select("id, type, message, meta, created_at")
    .eq("request_id", requestId)
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const c = Number(cursor);
    if (!Number.isNaN(c)) q = q.lt("id", c);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const nextCursor =
    data && data.length === limit ? String(data[data.length - 1].id) : null;

  return NextResponse.json({ activity: data ?? [], nextCursor });
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
