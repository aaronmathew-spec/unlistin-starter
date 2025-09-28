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

  const id = params.id;

  // Verify the request exists and is owned by this user via RLS.
  const { data: requestRow, error: reqErr } = await supabase
    .from("requests")
    .select("id")
    .eq("id", id)
    .limit(1)
    .maybeSingle();

  if (reqErr) {
    const msg = reqErr.message.toLowerCase();
    const status =
      msg.includes("permission denied") ? 403 :
      msg.includes("jwt") || msg.includes("auth") ? 401 :
      400;
    const out = NextResponse.json({ error: reqErr.message }, { status });
    res.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  if (!requestRow) {
    const out = NextResponse.json({ error: "Request not found" }, { status: 404 });
    res.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  // List files from Storage bucket "request-files" under folder "<id>/"
  const folder = `${id}/`;

  const { data: entries, error: listErr } = await supabase
    .storage
    .from("request-files")
    .list(folder, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

  if (listErr) {
    const out = NextResponse.json({ error: listErr.message }, { status: 400 });
    res.headers.forEach((v, k) => out.headers.set(k, v));
    return out;
  }

  const files = await Promise.all(
    (entries ?? []).map(async (f) => {
      const path = `${folder}${f.name}`;
      const { data: signed, error: signErr } =
        await supabase.storage.from("request-files").createSignedUrl(path, 3600);

      return {
        name: f.name,
        path,
        signedUrl: signErr ? null : signed?.signedUrl ?? null,
        error: signErr?.message ?? null,
      };
    })
  );

  const out = NextResponse.json({ files }, { status: 200 });
  res.headers.forEach((v, k) => out.headers.set(k, v));
  return out;
}
