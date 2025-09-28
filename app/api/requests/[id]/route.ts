// app/api/requests/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/** Build a Supabase server client that can read/write auth cookies */
function supabaseFrom(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          // propagate cookie changes back to the client
          res.cookies.set(name, value, options as any);
        },
        remove: (name: string, options: CookieOptions) => {
          res.cookies.set(name, "", { ...(options as any), maxAge: 0 });
        },
      },
    }
  );

  return { supabase, res };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, res } = supabaseFrom(req);

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Ensure we have a session (prevents RLS confusion)
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS should ensure only the owner can read this row
  const { data, error } = await supabase
    .from("requests")
    .select(
      "id, site_url, category, notes, status, created_at, updated_at"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Request not found" },
      { status: 404 }
    );
  }

  // Return JSON while preserving any cookie updates set by Supabase
  const json = JSON.stringify({ request: data });
  const out = new NextResponse(json, {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  // copy cookie headers from the intermediate response
  res.headers.forEach((v, k) => out.headers.set(k, v));
  return out;
}
