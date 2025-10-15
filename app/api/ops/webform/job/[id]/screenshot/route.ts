// app/api/ops/webform/job/[id]/screenshot/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response("env_missing", { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const sb = srv();
  const { data, error } = await sb
    .from("webform_jobs")
    .select("artifact_screenshot")
    .eq("id", id)
    .single();

  if (error) return new Response("not_found", { status: 404 });
  const raw = data?.artifact_screenshot;
  if (!raw) return new Response("no_screenshot", { status: 404 });

  const buf = Buffer.isBuffer(raw) ? (raw as Buffer) : Buffer.from(raw as any);
  const body = Uint8Array.from(buf);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
    },
  });
}
