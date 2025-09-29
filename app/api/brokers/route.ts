// app/api/brokers/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000).optional(),
});

const UpdateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().max(2000).nullable().optional(),
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

  await logActivity({
    entity_type: "broker",
    entity_id: data.id,
    action: "create",
    meta: { name: data.name },
  });

  return NextResponse.json({ broker: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  const json = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;

  const update: Record<string, unknown> = {};
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.url !== undefined) update.url = fields.url;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { data: before } = await supabase
    .from("brokers")
    .select("id, name, url")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("brokers")
    .update(update)
    .eq("id", id)
    .select("id, name, url, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(update)) {
    changed[k] = { from: (before as any)?.[k], to: (data as any)?.[k] };
  }
  await logActivity({
    entity_type: "broker",
    entity_id: data.id,
    action: "update",
    meta: changed,
  });

  return NextResponse.json({ broker: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  const url = new URL(req.url);
  const idFromQuery = url.searchParams.get("id");
  const body = await req.json().catch(() => ({}));
  const id = Number(idFromQuery ?? (body as any).id);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { count, error: cntErr } = await supabase
    .from("coverage")
    .select("*", { count: "exact", head: true })
    .eq("broker_id", id);

  if (cntErr) {
    return NextResponse.json({ error: cntErr.message }, { status: 400 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Broker has coverage items and cannot be deleted." },
      { status: 409 }
    );
  }

  const { data: row } = await supabase
    .from("brokers")
    .select("id, name")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("brokers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    entity_type: "broker",
    entity_id: id,
    action: "delete",
    meta: { name: row?.name ?? null },
  });

  return NextResponse.json({ ok: true, deletedId: id });
}

/* --------------------- */
function clamp(val: string | null, fallback: number, min: number, max: number) {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
