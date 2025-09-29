// app/api/requests/[id]/activity/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ActivityRow = {
  id: number;
  type: "status_changed" | "file_uploaded" | "file_deleted" | "request_created";
  message: string;
  meta: unknown | null;
  created_at: string;
};

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

  const list = (data ?? []) as ActivityRow[];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;

  return NextResponse.json({ activity: list, nextCursor });
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
