// app/api/brokers/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const limit = clamp(searchParams.get("limit"), 50, 1, 200);
  const cursor = searchParams.get("cursor");

  let q = supabase
    .from("brokers")
    .select("id, name, url, created_at, updated_at")
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const c = Number(cursor);
    if (!Number.isNaN(c)) q = q.lt("id", c);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = data ?? [];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;

  return NextResponse.json({ brokers: list, nextCursor });
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  const json = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("brokers")
    .insert({ name: parsed.data.name, url: parsed.data.url ?? null })
    .select("id, name, url, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ broker: data }, { status: 201 });
}

/* --------------------- */
function clamp(val: string | null, fallback: number, min: number, max: number) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
