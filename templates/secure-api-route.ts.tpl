// app/api/{{slice}}/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional()
});

export async function GET(_req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("{{slice}}")
    .select("id, title, description, created_at, updated_at")
    .order("id", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();

  const json = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("{{slice}}")
    .insert({ title: parsed.data.title, description: parsed.data.description ?? null })
    .select("id, title, description, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // optional: best-effort activity
  await supabase.from("request_activity").insert({
    request_id: data.id, // if this is not a request table, change/remove accordingly
    type: "request_created",
    message: `Created in {{slice}}: ${data.title ?? `#${data.id}`}`,
    meta: { table: "{{slice}}" }
  }).catch(() => {});

  return NextResponse.json({ item: data }, { status: 201 });
}
