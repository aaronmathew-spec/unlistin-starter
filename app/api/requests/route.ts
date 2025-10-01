// app/api/requests/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import crypto from "node:crypto";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

/**
 * GET /api/requests
 * Query:
 *   - limit: number (1..100, default 20)
 *   - cursor: last seen id (keyset)
 *   - dir: 'desc' | 'asc' (default 'desc')
 *   - q: free-text; matches title/description (ilike)
 *   - status: exact status value (optional)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "20"), 1), 100);
    const dir = (url.searchParams.get("dir") ?? "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const cursor = url.searchParams.get("cursor");
    const q = (url.searchParams.get("q") ?? "").trim();
    const status = (url.searchParams.get("status") ?? "").trim();

    const db = supa();
    let query = db.from("requests").select("id, title, description, status, created_at");

    // Filters
    if (q) {
      // Match in title or description (case-insensitive)
      const escaped = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
      query = query.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%`,
        { referencedTable: "requests" }
      );
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Cursor (keyset on id)
    if (cursor) {
      const c = Number(cursor);
      if (Number.isFinite(c)) {
        query = dir === "desc" ? query.lt("id", c) : query.gt("id", c);
      }
    }

    query = query.order("id", { ascending: dir === "asc" }).limit(limit);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as {
      id: number;
      title: string;
      description: string | null;
      status: string;
      created_at: string;
    }[];

    const nextCursor = rows.length === limit ? String(rows[rows.length - 1]!.id) : null;
    return NextResponse.json({ requests: rows, nextCursor });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/requests  (demo-only creator; non-PII)
 * Body (JSON):
 *   - broker: string (required)
 *   - url: string (required, evidence URL)
 *   - mode: 'auto' | 'manual' (optional, default 'manual')
 *
 * Behavior:
 *   - Validates inputs but DOES NOT persist to DB.
 *   - Returns an opaque id suitable for demo navigation.
 *   - Leaves GET behavior completely unchanged.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const broker = (body?.broker ?? "").toString().trim();
    const evidence = (body?.url ?? "").toString().trim();
    const mode = ((body?.mode ?? "manual") === "auto" ? "auto" : "manual") as "auto" | "manual";

    if (!broker || !evidence) {
      return NextResponse.json(
        { ok: false, error: "Missing broker or evidence URL." },
        { status: 400 }
      );
    }
    // No PII stored; just synthesize an opaque id for demo flows
    const id = crypto.randomBytes(8).toString("hex");

    return NextResponse.json({
      ok: true,
      id,
      mode,
      broker,
      evidence,
      next: "/requests/new",
      note: "Demo only — no data persisted.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unexpected error" },
      { status: 500 }
    );
  }
}
