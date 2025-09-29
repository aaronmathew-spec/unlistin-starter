// app/api/coverage/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CreateSchema = z.object({
  broker_id: z.number().int().positive(),
  surface: z.string().min(1).max(200),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  weight: z.number().positive().max(9999).optional(),
  note: z.string().max(2000).optional(),
});

const UpdateSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  note: z.string().max(2000).optional(),
  weight: z.number().positive().max(9999).optional(),
});

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);
  const limit = clamp(searchParams.get("limit"), 50, 1, 200);
  const cursor = searchParams.get("cursor");
  const brokerId = searchParams.get("broker_id");

  let q = supabase
    .from("coverage")
    .select("id, broker_id, surface, status, weight, note, created_at, updated_at")
    .order("id", { ascending: false })
    .limit(limit);

  if (brokerId) q = q.eq("broker_id", Number(brokerId));
  if (cursor) {
    const c = Number(cursor);
    if (!Number.isNaN(c)) q = q.lt("id", c);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = data ?? [];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;

  return NextResponse.json({ coverage: list, nextCursor });
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const json = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = {
    broker_id: parsed.data.broker_id,
    surface: parsed.data.surface,
    status: parsed.data.status ?? "open",
    weight: parsed.data.weight ?? 1,
    note: parsed.data.note ?? null,
  };

  const { data, error } = await supabase
    .from("coverage")
    .insert(payload)
    .select("id, broker_id, surface, status, weight, note, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ coverage: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const json = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from("coverage")
    .update(fields)
    .eq("id", id)
    .select("id, broker_id, surface, status, weight, note, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ coverage: data });
}

/* --------------------- */
function clamp(val: string | null, fallback: number, min: number, max: number) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
