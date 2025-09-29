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

type BodyIn = {
  title?: string;
  description?: string;
  status?: string;
};

export async function POST(req: Request) {
  try {
    const payload = (await req.json().catch(() => ({}))) as BodyIn;
    const title = (payload.title ?? "").trim();
    const description = (payload.description ?? "").trim();
    const status = (payload.status ?? "open").trim();

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const db = supa();

    // Insert under RLS; user_id is set via policies/trigger or inferred from auth
    const { data, error } = await db
      .from("requests")
      .insert({ title, description, status })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Fire-and-forget AI index
    if (data?.id) {
      queueIndex("request", data.id);
    }

    return NextResponse.json({ id: data?.id, ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
