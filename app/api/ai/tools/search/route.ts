/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { envBool } from "@/lib/env";
import type { FileHit, RequestHit } from "@/types/ai";

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

/**
 * GET /api/ai/tools/search?q=...
 * RLS-friendly keyword search across:
 *   - requests (title, description)
 *   - request_files (name)
 *
 * Notes:
 * - Uses SSR Supabase client so RLS enforces org/user scope.
 * - If you later add tsvector columns, you can swap .ilike/.or for .textSearch.
 * - Feature gated with FEATURE_AI_SERVER (defaults to enabled).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const topK = Math.max(1, Math.min(25, Number(url.searchParams.get("topK") ?? "10")));

  // Feature gate (defaults ON)
  const enabled = envBool("FEATURE_AI_SERVER", true);
  if (!enabled) return json({ requests: [], files: [] }, { status: 200 });

  // Empty query → empty result for safety
  if (!q) return json({ requests: [], files: [] });

  // RLS-friendly Supabase client (scoped to user session cookies)
  const jar = cookies();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k: string) => jar.get(k)?.value } }
  );

  try {
    // ---------- Requests ----------
    // Basic keyword match on title/description; newest first.
    const { data: reqRows, error: reqErr } = await db
      .from("requests")
      .select("id, title, description, status, created_at")
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(topK);

    if (reqErr) throw reqErr;

    const requests: RequestHit[] = (reqRows || []).map((r: any) => ({
      kind: "request",
      id: Number(r.id),
      title: r.title ?? null,
      description: r.description ?? null,
      status: r.status ?? null,
      created_at: new Date(r.created_at).toISOString(),
    }));

    // ---------- Files ----------
    // Keyword match on filename; newest first.
    const { data: fileRows, error: fileErr } = await db
      .from("request_files")
      .select("id, request_id, name, mime, size_bytes, created_at")
      .ilike("name", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(topK);

    if (fileErr) throw fileErr;

    const files: FileHit[] = (fileRows || []).map((f: any) => ({
      kind: "file",
      id: Number(f.id),
      request_id: Number(f.request_id),
      name: String(f.name ?? ""),
      mime: f.mime ?? null,
      size_bytes: Number.isFinite(f.size_bytes) ? Number(f.size_bytes) : null,
      created_at: new Date(f.created_at).toISOString(),
    }));

    return json({ requests, files });
  } catch (e: any) {
    return json({ requests: [], files: [], error: e?.message ?? "Search failed" }, { status: 500 });
  }
}
