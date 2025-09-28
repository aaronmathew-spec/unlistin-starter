// app/api/requests/[id]/files/route.ts
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

  // Auth check keeps errors predictable under RLS
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

  // We keep files under "request-files" bucket in folder "<id>/"
  const folder = `${params.id}/`;

  // List files
  const { data: entries, error: listErr } = await supabase
    .storage
    .from("request-files")
    .list(folder, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 400 });
  }

  // Create signed URLs for display/download
  const files = await Promise.all(
    (entries ?? []).map(async (f) => {
      const path = `${folder}${f.name}`;
      const { data: signed, error: signErr } =
        await supabase.storage.from("request-files").createSignedUrl(path, 60 * 60); // 1 hour

      return {
        name: f.name,
        path,
        created_at: (f as any)?.created_at ?? null,
        last_modified: (f as any)?.updated_at ?? null,
        size: (f as any)?.metadata?.size ?? null,
        signedUrl: signErr ? null : signed?.signedUrl ?? null,
        error: signErr?.message ?? null,
      };
    })
  );

  const json = JSON.stringify({ files });
  const out = new NextResponse(json, {
    status: 200,
    headers: { "content-type": "application/json" },
  });

  res.headers.forEach((v, k) => out.headers.set(k, v));
  return out;
}
