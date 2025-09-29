// app/api/requests/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RequestRow = {
  id: number;
  title: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string | null;
  updated_at: string | null;
};

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  const { searchParams } = new URL(req.url);
  const limit = clampInt(searchParams.get("limit"), 20, 1, 100);
  const cursor = searchParams.get("cursor");
  const q = (searchParams.get("q") || "").trim();
  const status = (searchParams.get("status") || "").trim();

  let query = supabase
    .from("requests")
    .select("id, title, status, created_at, updated_at")
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const cursorId = Number(cursor);
    if (!Number.isNaN(cursorId)) query = query.lt("id", cursorId);
  }

  if (status) {
    const allowed = new Set(["open", "in_progress", "resolved", "closed"]);
    if (allowed.has(status)) query = query.eq("status", status);
  }

  if (q.length > 0) {
    const needle = `%${escapeIlike(q)}%`;
    query = query.or(`title.ilike.${needle},description.ilike.${needle}`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const list = (data ?? []) as RequestRow[];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;

  return NextResponse.json({ requests: list, nextCursor });
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as { title?: unknown; description?: unknown };
  const title =
    typeof b.title === "string" ? b.title.trim().slice(0, 200) : null;
  const description =
    typeof b.description === "string" ? b.description.trim().slice(0, 5000) : null;

  if (!title || title.length === 0) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("requests")
    .insert({ title, description })
    .select("id, title, status, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("request_activity").insert({
    request_id: inserted.id,
    type: "request_created",
    message: `Request created: ${inserted.title ?? `#${inserted.id}`}`,
    meta: { status: inserted.status },
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

function escapeIlike(s: string) {
  return s.replace(/[%_]/g, (m) => `\\${m}`);
}
