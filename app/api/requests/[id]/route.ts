import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function supabaseFrom(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
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

  // Ensure we have a session (helps disambiguate RLS errors)
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

  // NOTE: do not force Number() – let PostgREST coerce; avoids NaN edge cases.
  const id = params.id;

  const { data, error } = await supabase
    .from("requests")
    .select("id, site_url, category, notes, status, created_at, updated_at")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (error) {
    const msg = error.message.toLowerCase();
    const status =
      msg.includes("permission denied") ? 403 :
      msg.includes("jwt") || msg.includes("auth") ? 401 :
      400;

    const out = NextResponse.json({ error: error.message }, { status });
    res.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  if (!data) {
    const out = NextResponse.json({ error: "Request not found" }, { status: 404 });
    res.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  const out = NextResponse.json({ request: data }, { status: 200 });
  res.headers.forEach((v, k) => out.headers.set(k, v));
  return out;
}
