import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Build a Supabase server client that reads the user's auth cookie
function getSupabaseSSR() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // No-ops for routes (Next.js App Router doesn’t let us set cookies from here)
        set() {},
        remove() {},
      },
    }
  );
}

// GET /api/tasks?cursor=ID&limit=20
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);

  const supabase = getSupabaseSSR();

  let q = supabase
    .from("background_tasks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (cursor) {
    // keyset by id (works fine since ids are monotonic with created_at)
    q = q.lt("id", Number(cursor));
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const nextCursor = data && data.length === limit ? String(data[data.length - 1].id) : null;
  return NextResponse.json({ tasks: data ?? [], nextCursor });
}

// POST /api/tasks  { type, request_id?, payload? }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { type, request_id, payload } = body ?? {};

  if (!type || typeof type !== "string") {
    return NextResponse.json({ error: "Missing 'type'." }, { status: 400 });
  }

  const supabase = getSupabaseSSR();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("background_tasks")
    .insert({
      type,
      request_id: request_id ?? null,
      payload: payload ?? {},
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ task: data });
}
