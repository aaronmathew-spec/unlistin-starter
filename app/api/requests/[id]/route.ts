export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { queueIndex } from "@/lib/ai/indexQueue";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const db = supa();
    const { data, error } = await db
      .from("requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ request: data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

type PatchIn = {
  title?: string | null;
  description?: string | null;
  status?: string | null;
};

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const id = Number(ctx.params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as PatchIn;
    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.description === "string")
      patch.description = body.description.trim();
    if (typeof body.status === "string") patch.status = body.status.trim();

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const db = supa();
    const { data, error } = await db
      .from("requests")
      .update(patch)
      .eq("id", id)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data?.id) queueIndex("request", data.id);

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
