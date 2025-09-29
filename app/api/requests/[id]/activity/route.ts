// app/api/requests/[id]/activity/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const requestId = Number(params.id);
  if (!Number.isFinite(requestId)) {
    return NextResponse.json({ error: "invalid request id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = clamp(url.searchParams.get("limit"), 50, 1, 200);
  const cursor = url.searchParams.get("cursor");

  // We want:
  //  - entity_type='request' AND entity_id=requestId
  //  - OR (entity_type='file' AND meta->>'scope'='request' AND meta->>'request_id'=requestId)
  // Supabase 'or' filter supports JSON path via meta->>key.eq.value
  let q = supabase
    .from("activity")
    .select("id, entity_type, entity_id, action, meta, created_at")
    .order("id", { ascending: false })
    .limit(limit);

  const orExpr =
    `and(entity_type.eq.request,entity_id.eq.${requestId}),` +
    `and(entity_type.eq.file,meta->>scope.eq.request,meta->>request_id.eq.${requestId})`;

  q = q.or(orExpr);

  if (cursor) {
    const c = Number(cursor);
    if (!Number.isNaN(c)) q = q.lt("id", c);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = data ?? [];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;
  return NextResponse.json({ activity: list, nextCursor });
}

function clamp(v: string | null, fallback: number, min: number, max: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
