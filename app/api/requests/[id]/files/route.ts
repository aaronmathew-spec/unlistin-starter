// app/api/requests/[id]/files/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const BUCKET = 'request-files'; // <-- adjust if your bucket name differs
const SIGNED_SECONDS = 60 * 60; // 1 hour

function getServerClient(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
      } as unknown as CookieOptions,
    }
  );
  return supabase;
}

// Admin client (service role) is only used on the server to create signed URLs.
function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // must be set in Vercel env
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // 1) Verify session & ownership via RLS
    const sb = getServerClient(req);
    const {
      data: { user },
      error: userErr,
    } = await sb.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Make sure the request exists & is visible to this user (RLS)
    const { data: requestRow, error: requestErr } = await sb
      .from('requests')
      .select('id')
      .eq('id', id)
      .single();

    if (requestErr) {
      return NextResponse.json({ error: requestErr.message }, { status: 400 });
    }
    if (!requestRow) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // 2) Read files metadata from your table
    // Be permissive about column names: path | file_path | storage_path | object_path | key
    const { data: rows, error: listErr } = await sb
      .from('request_files')
      .select(
        `
          id,
          name,
          path,
          file_path,
          storage_path,
          object_path,
          key,
          mime_type,
          content_type,
          size,
          size_bytes,
          created_at
        `
      )
      .eq('request_id', id)
      .order('created_at', { ascending: false });

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 400 });
    }

    const admin = getAdminClient();

    // 3) For each file, compute a signed URL server-side
    const files = await Promise.all(
      (rows ?? []).map(async (r: any) => {
        const pathRaw =
          r.path ??
          r.file_path ??
          r.storage_path ??
          r.object_path ??
          r.key; // first non-null

        let signedUrl: string | null = null;
        if (pathRaw) {
          const { data: signed, error: signErr } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(pathRaw, SIGNED_SECONDS);
          if (!signErr && signed?.signedUrl) {
            signedUrl = signed.signedUrl;
          }
        }

        return {
          id: r.id,
          name: r.name ?? pathRaw ?? 'file',
          path: pathRaw,
          created_at: r.created_at,
          contentType: r.mime_type ?? r.content_type ?? null,
          size: r.size ?? r.size_bytes ?? null,
          signedUrl,
        };
      })
    );

    return NextResponse.json({ files });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
