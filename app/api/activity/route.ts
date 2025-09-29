// app/api/activity/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);

  const limit = clamp(searchParams.get("limit"), 50, 1, 200);
  const cursor = searchParams.get("cursor");
  const entityType = searchParams.get("entity_type") || ""; // optional filter
  const entityId = searchParams.get("entity_id");

  let q = supabase
    .from("activity")
    .select("id, entity_type, entity_id, action, meta, created_at")
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const c = Number(cursor);
    if (!Number.isNaN(c)) q = q.lt("id", c);
  }
  if (entityType) q = q.eq("entity_type", entityType);
  if (entityId) q = q.eq("entity_id", Number(entityId));

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = data ?? [];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;

  return NextResponse.json({ activity: list, nextCursor });
}

function clamp(val: string | null, fallback: number, min: number, max: number) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
