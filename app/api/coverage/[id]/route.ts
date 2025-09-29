// app/api/coverage/[id]/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PatchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  note: z.string().max(2000).optional(),
  weight: z.number().positive().max(9999).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const id = Number(params.id);
  const json = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("coverage")
    .update(parsed.data)
    .eq("id", id)
    .select("id, broker_id, surface, status, weight, note, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ coverage: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseServerClient();
  const id = Number(params.id);

  // Best-effort: delete related evidence first via storage + table?
  // Storage cleanup is already handled per-file. Here we remove the rows;
  // Storage orphans (if any) are harmless but you can cron-clean them later.
  const { error } = await supabase.from("coverage").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, deletedId: id });
}
