import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSSR() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * GET /api/coverage?cursor=<id>&limit=20
 * Returns { coverage: rows[], nextCursor }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  const supabase = getSSR();

  let q = supabase
    .from("coverage_scores")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    q = q.lt("id", Number(cursor));
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = Array.isArray(data) ? data : [];
  const nextCursor =
    rows.length === limit && rows[rows.length - 1]?.id != null
      ? String(rows[rows.length - 1].id)
      : null;

  return NextResponse.json({ coverage: rows, nextCursor });
}

/**
 * POST /api/coverage
 * Body: { request_id: number }
 * Creates a new snapshot row for that request based on current files_count.
 */
export async function POST(req: Request) {
  const supabase = getSSR();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const request_id = Number(body?.request_id ?? 0);
  if (!request_id) {
    return NextResponse.json({ error: "Missing or invalid request_id" }, { status: 400 });
  }

  // Confirm request belongs to this user
  const { data: reqRow, error: reqErr } = await supabase
    .from("requests")
    .select("id")
    .eq("id", request_id)
    .single();

  if (reqErr || !reqRow) {
    return NextResponse.json({ error: "Request not found or not accessible" }, { status: 404 });
  }

  // Count files for the request (RLS ensures only user's files are visible)
  const { data: files, error: filesErr } = await supabase
    .from("request_files")
    .select("id", { count: "exact", head: true })
    .eq("request_id", request_id);

  if (filesErr) {
    return NextResponse.json({ error: filesErr.message }, { status: 400 });
  }

  const files_count = (files as any)?.length ?? (files as any)?.count ?? 0;

  // Very basic "exposure" example: proportional to files
  const exposure = Math.min(50, files_count * 5);

  const score = clamp(files_count * 10 + exposure, 0, 100);

  const { data: inserted, error: insErr } = await supabase
    .from("coverage_scores")
    .insert({
      request_id,
      score,
      files_count,
      exposure,
    })
    .select("*")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ coverage: inserted });
}
