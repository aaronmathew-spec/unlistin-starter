// app/api/scan/runs/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/** GET /api/scan/runs/:id -> { run, hits } (RLS enforced) */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const db = supa();

  const { data: run, error: e1 } = await db
    .from("scan_runs")
    .select("id, created_at, status, query_preview, took_ms")
    .eq("id", id)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: hits, error: e2 } = await db
    .from("scan_hits")
    .select("id, rank, broker, category, url, confidence, matched_fields, evidence")
    .eq("run_id", id)
    .order("rank", { ascending: true });

  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

  return NextResponse.json({ run, hits: hits ?? [] });
}
