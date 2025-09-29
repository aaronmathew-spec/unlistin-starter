// app/api/coverage/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type CoverageRow = {
  id: number;
  broker_id: number;
  surface: string;
  status: "open" | "in_progress" | "resolved";
  weight: number | null;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

// GET /api/coverage?limit=50&cursor=opaque
export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 50)));
  const cursor = searchParams.get("cursor");

  let query = supabase
    .from("coverage")
    .select("id,broker_id,surface,status,weight,note,created_at,updated_at")
    .order("id", { ascending: true })
    .limit(limit);

  if (cursor) {
    const after = Number(cursor);
    if (Number.isFinite(after)) query = query.gt("id", after);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows: CoverageRow[] = (data ?? []) as CoverageRow[];

  // Use .at(-1) and optional chaining to avoid "possibly undefined"
  const lastId = rows.at(-1)?.id ?? null;
  const nextCursor = rows.length === limit && lastId !== null ? String(lastId) : null;

  return NextResponse.json({ coverage: rows, nextCursor });
}

// POST /api/coverage
// body: { broker_id: number, surface: string, note?: string, weight?: number }
export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => ({}));
  const { broker_id, surface, note, weight } = body || {};

  if (!broker_id || !surface || typeof surface !== "string") {
    return NextResponse.json({ error: "broker_id and surface are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("coverage")
    .insert({
      broker_id,
      surface,
      note: note ?? null,
      weight: Number.isFinite(Number(weight)) ? Number(weight) : 1,
    })
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ coverage: data as CoverageRow });
}

// PATCH /api/coverage
// body: { id: number, surface?, status?, note?, weight? }
export async function PATCH(req: Request) {
  const supabase = createSupabaseServerClient();
  const body = await req.json().catch(() => ({}));
  const { id, surface, status, note, weight } = body || {};
  const pid = Number(id);
  if (!Number.isFinite(pid)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof surface === "string") update.surface = surface;
  if (status) update.status = status; // "open" | "in_progress" | "resolved"
  if (note !== undefined) update.note = note;
  if (weight !== undefined) update.weight = Number(weight);

  const { data, error } = await supabase
    .from("coverage")
    .update(update)
    .eq("id", pid)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ coverage: data as CoverageRow });
}

// DELETE /api/coverage?id=123
export async function DELETE(req: Request) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get("id");
  const id = Number(idParam);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { error } = await supabase.from("coverage").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
