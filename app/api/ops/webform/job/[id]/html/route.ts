/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new Response("env_missing", { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const sb = srv();
  // We keep the selection tight to avoid large row payloads.
  const { data, error } = await sb
    .from("webform_jobs")
    .select("result")
    .eq("id", id)
    .single();

  if (error || !data) return new Response("not_found", { status: 404 });

  const html: unknown =
    (data as any)?.result?.html ??
    (data as any)?.result?.page_html ??
    (data as any)?.result?.raw_html ??
    null;

  if (typeof html !== "string" || !html.trim()) {
    return new Response("no_html", { status: 404 });
  }

  const url = new URL(req.url);
  const isDownload = url.searchParams.get("download") === "1";

  const headers: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  };
  if (isDownload) {
    headers["content-disposition"] = `attachment; filename="webform-${id}.html"`;
  }

  // Strings are valid BodyInit; send directly.
  return new Response(html, { status: 200, headers });
}
