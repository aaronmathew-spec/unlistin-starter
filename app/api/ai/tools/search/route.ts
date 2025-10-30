/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { envBool } from "@/lib/env";

// Local types (avoid importing external types to keep builds green)
type RequestHit = {
  kind: "request";
  id: number;
  title: string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
};

type FileHit = {
  kind: "file";
  id: number;
  request_id: number | null;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

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
 * GET /api/ai/tools/search?q=...&topK=10
 *
 * Search strategy:
 *  - If FEATURE_AI_FTS=1 and FTS columns exist, use Postgres FTS via .textSearch() (fast, ranked).
 *  - Otherwise, fall back to safe ILIKE path (RLS-friendly, no migrations required).
 *
 * RLS: Uses SSR Supabase client bound to session cookies (anon key) so RLS stays enforced.
 * Shape: { requests: RequestHit[], files: FileHit[] }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const qRaw = (url.searchParams.get("q") || "").trim();
  const topK = Math.max(1, Math.min(50, Number(url.searchParams.get("topK") ?? "10")));

  // Feature flags (defaults: AI server on; FTS off)
  const enabled = envBool("FEATURE_AI_SERVER", true);
  const useFts = envBool("FEATURE_AI_FTS", false);

  if (!enabled) return json({ requests: [], files: [] }, { status: 200 });
  if (!qRaw) return json({ requests: [], files: [] });

  // Escape special LIKE wildcards for fallback path
  const qLike = qRaw.replace(/%/g, "\\%").replace(/_/g, "\\_");

  // FTS query: turn "foo bar" into "foo:* & bar:*"
  const ftsQuery = qRaw
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `${t}:*`)
    .join(" & ");

  const jar = cookies();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k: string) => jar.get(k)?.value } }
  );

  try {
    let requests: RequestHit[] = [];
    let files: FileHit[] = [];

    if (useFts) {
      // ---------- FTS path ----------
      const { data: reqRows, error: reqErr } = await (db
        .from("requests")
        .select("id, title, description, status, created_at") as any)
        .textSearch("fts", ftsQuery, { type: "plain" }) // to_tsquery-ish
        .order("created_at", { ascending: false })
        .limit(topK);

      if (reqErr) throw reqErr;

      requests = (reqRows ?? []).map((r: any) => ({
        kind: "request",
        id: Number(r.id),
        title: r.title ?? null,
        description: r.description ?? null,
        status: r.status ?? null,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));

      const { data: fileRows, error: fileErr } = await (db
        .from("request_files")
        .select("id, request_id, name, mime, size_bytes, created_at") as any)
        .textSearch("fts", ftsQuery, { type: "plain" })
        .order("created_at", { ascending: false })
        .limit(topK);

      if (fileErr) throw fileErr;

      files = (fileRows ?? []).map((f: any) => ({
        kind: "file",
        id: Number(f.id),
        request_id: Number.isFinite(f.request_id) ? Number(f.request_id) : null,
        name: String(f.name ?? ""),
        mime: f.mime ?? null,
        size_bytes: Number.isFinite(f.size_bytes) ? Number(f.size_bytes) : null,
        created_at: f.created_at ? new Date(f.created_at).toISOString() : null,
      }));
    } else {
      // ---------- Fallback ILIKE path ----------
      const { data: reqRows, error: reqErr } = await db
        .from("requests")
        .select("id, title, description, status, created_at")
        .or(`title.ilike.%${qLike}%,description.ilike.%${qLike}%`)
        .order("created_at", { ascending: false })
        .limit(topK);

      if (reqErr) throw reqErr;

      requests = (reqRows ?? []).map((r: any) => ({
        kind: "request",
        id: Number(r.id),
        title: r.title ?? null,
        description: r.description ?? null,
        status: r.status ?? null,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));

      const { data: fileRows, error: fileErr } = await db
        .from("request_files")
        .select("id, request_id, name, mime, size_bytes, created_at")
        .or(`name.ilike.%${qLike}%`)
        .order("created_at", { ascending: false })
        .limit(topK);

      if (fileErr) throw fileErr;

      files = (fileRows ?? []).map((f: any) => ({
        kind: "file",
        id: Number(f.id),
        request_id: Number.isFinite(f.request_id) ? Number(f.request_id) : null,
        name: String(f.name ?? ""),
        mime: f.mime ?? null,
        size_bytes: Number.isFinite(f.size_bytes) ? Number(f.size_bytes) : null,
        created_at: f.created_at ? new Date(f.created_at).toISOString() : null,
      }));
    }

    return json({ requests, files });
  } catch (e: any) {
    return json({ requests: [], files: [], error: e?.message ?? "Search failed" }, { status: 500 });
  }
}
