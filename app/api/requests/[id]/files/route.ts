import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// --- Supabase server client (Next.js cookie bridge)
function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          // Next.js doesn't have "delete"; use set with maxAge 0
          cookieStore.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );
}

const BUCKET = 'request-files'; // <- your storage bucket name

/**
 * GET /api/requests/:id/files
 * Returns metadata from request_files table + short-lived signedUrl
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('request_files')
    .select('id,name,path,content_type,size,created_at')
    .eq('request_id', params.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const files = await Promise.all(
    (data ?? []).map(async (row) => {
      let signedUrl: string | null = null;
      if (row.path) {
        const { data: sign } = await supabase
          .storage
          .from(BUCKET)
          .createSignedUrl(row.path, 60 * 10); // 10 minutes
        signedUrl = sign?.signedUrl ?? null;
      }
      return {
        id: row.id,
        name: row.name,
        path: row.path,
        contentType: row.content_type,
        size: row.size,
        created_at: row.created_at,
        signedUrl,
      };
    })
  );

  return NextResponse.json({ files });
}

/**
 * POST /api/requests/:id/files
 * Content-Type: multipart/form-data
 *  - file: <File>
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const requestId = params.id;
  const fileId = randomUUID();
  const ext = (file.name?.split('.').pop() || 'bin').toLowerCase();
  const objectPath = `${user.id}/${requestId}/${fileId}.${ext}`;

  // 1) Upload to Storage
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // 2) Insert DB metadata row
  const { data: inserted, error: insErr } = await supabase
    .from('request_files')
    .insert({
      id: fileId, // remove this if your table auto-generates UUIDs
      request_id: requestId,
      name: file.name || null,
      path: objectPath,
      content_type: file.type || null,
      size: file.size || null,
    })
    .select('id,name,path,content_type,size,created_at')
    .single();

  if (insErr) {
    // rollback the object if DB insert fails
    await supabase.storage.from(BUCKET).remove([objectPath]);
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  // 3) Sign the object for immediate preview
  const { data: sign } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(inserted.path, 60 * 10);

  const signedUrl = sign?.signedUrl ?? null;

  return NextResponse.json({
    file: {
      id: inserted.id,
      name: inserted.name,
      path: inserted.path,
      contentType: inserted.content_type,
      size: inserted.size,
      created_at: inserted.created_at,
      signedUrl,
    },
  });
}
