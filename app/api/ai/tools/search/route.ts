export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Results we return to the client/AI
type RequestHit = {
  kind: "request";
  id: number;
  title: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
};

type FileHit = {
  kind: "file";
  id: number;
  request_id: number;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { get: (k) => jar.get(k)?.value },
    }
  );
}

function normalizeQuery(q: string | null): string {
  const s = (q ?? "").trim();
  return s.slice(0, 256); // keep it bounded
}

/**
 * GET /api/ai/tools/search?q=...&limit=...
 * Returns { requests: RequestHit[], files: FileHit[] }
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = normalizeQuery(url.searchParams.get("q"));
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit")) || 10));
    if (!q) return NextResponse.json({ requests: [], files: [] });

    const db = supa();

    // Requests: use full-text match, fallback to ILIKE
    const { data: reqsFTS, error: reqsErr } = await db
      .from("requests")
      .select("id, title, description, status, created_at")
      .filter("to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))", "plainto_tsquery", q)
      .order("created_at", { ascending: false })
      .limit(limit);

    let requests: RequestHit[] = (reqsFTS ?? []).map((r: any) => ({
      kind: "request",
      id: r.id,
      title: r.title ?? null,
      description: r.description ?? null,
      status: r.status ?? null,
      created_at: r.created_at,
    }));

    // Fallback if FTS returns nothing (short queries, etc.)
    if (!requests.length) {
      const { data: reqsILIKE } = await db
        .from("requests")
        .select("id, title, description, status, created_at")
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(limit);
      requests = (reqsILIKE ?? []).map((r: any) => ({
        kind: "request",
        id: r.id,
        title: r.title ?? null,
        description: r.description ?? null,
        status: r.status ?? null,
        created_at: r.created_at,
      }));
    }

    // Files: name FTS, fallback to ILIKE
    const { data: filesFTS, error: filesErr } = await db
      .from("request_files")
      .select("id, request_id, name, mime, size_bytes, created_at")
      .filter("to_tsvector('english', coalesce(name,''))", "plainto_tsquery", q)
      .order("created_at", { ascending: false })
      .limit(limit);

    let files: FileHit[] = (filesFTS ?? []).map((f: any) => ({
      kind: "file",
      id: f.id,
      request_id: f.request_id,
      name: f.name,
      mime: f.mime ?? null,
      size_bytes: f.size_bytes ?? null,
      created_at: f.created_at,
    }));

    if (!files.length) {
      const { data: filesILIKE } = await db
        .from("request_files")
        .select("id, request_id, name, mime, size_bytes, created_at")
        .ilike("name", `%${q}%`)
        .order("created_at", { ascending: false })
        .limit(limit);
      files = (filesILIKE ?? []).map((f: any) => ({
        kind: "file",
        id: f.id,
        request_id: f.request_id,
        name: f.name,
        mime: f.mime ?? null,
        size_bytes: f.size_bytes ?? null,
        created_at: f.created_at,
      }));
    }

    // No leakage: RLS governs visibility
    return NextResponse.json({ requests, files });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error" }, { status: 500 });
  }
}
