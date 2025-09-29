// app/api/requests/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

const StatusEnum = z.enum(["open", "in_progress", "resolved", "closed"]);

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
});

const UpdateSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: StatusEnum.optional(),
});

const DeleteSchema = z.object({
  id: z.number().int().positive(),
});

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { searchParams } = new URL(req.url);

  const limit = clampInt(searchParams.get("limit"), 50, 1, 200);
  const cursor = searchParams.get("cursor");
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim();

  let qreq = supabase
    .from("requests")
    .select("id, title, description, status, created_at, updated_at")
    .order("id", { ascending: false })
    .limit(limit);

  if (cursor) {
    const c = Number(cursor);
    if (!Number.isNaN(c)) qreq = qreq.lt("id", c);
  }

  if (status && StatusEnum.safeParse(status).success) {
    qreq = qreq.eq("status", status);
  }

  if (q.length > 0) {
    const pattern = `%${escapeLike(q)}%`;
    qreq = qreq.or(`title.ilike.${pattern},description.ilike.${pattern}`);
  }

  const { data, error } = await qreq;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = data ?? [];
  const nextCursor = list.length === limit ? String(list[list.length - 1]!.id) : null;

  return NextResponse.json({ requests: list, nextCursor });
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const json = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    status: "open" as const,
  };

  const { data, error } = await supabase
    .from("requests")
    .insert(payload)
    .select("id, title, description, status, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // activity
  await logActivity({
    entity_type: "request",
    entity_id: data.id,
    action: "create",
    meta: { title: data.title },
  });

  return NextResponse.json({ request: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const json = await req.json().catch(() => ({}));
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const { data: before } = await supabase
    .from("requests")
    .select("id, title, description, status")
    .eq("id", id)
    .single();

  const { data, error } = await supabase
    .from("requests")
    .update(fields)
    .eq("id", id)
    .select("id, title, description, status, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // activity (status vs. update)
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(fields)) {
    const key = k as keyof typeof fields;
    changed[key] = { from: (before as any)?.[key], to: (data as any)?.[key] };
  }
  const action = fields.status ? "status" : "update";
  await logActivity({
    entity_type: "request",
    entity_id: data.id,
    action,
    meta: changed,
  });

  return NextResponse.json({ request: data });
}

export async function DELETE(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  const url = new URL(req.url);
  const idFromQuery = url.searchParams.get("id");
  const body = await req.json().catch(() => ({}));
  const id = Number(idFromQuery ?? (body as any).id);

  const parsed = DeleteSchema.safeParse({ id });
  if (!parsed.success) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: row } = await supabase
    .from("requests")
    .select("id, title")
    .eq("id", parsed.data.id)
    .single();

  const { error } = await supabase.from("requests").delete().eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logActivity({
    entity_type: "request",
    entity_id: parsed.data.id,
    action: "delete",
    meta: { title: row?.title ?? null },
  });

  return NextResponse.json({ ok: true, deletedId: parsed.data.id });
}

/* ---------------- helpers ---------------- */

function clampInt(v: string | null, fallback: number, min: number, max: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
}
function escapeLike(input: string) {
  return input.replace(/[%_]/g, (m) => `\\${m}`);
}
