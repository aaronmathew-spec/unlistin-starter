import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// Create a Supabase server client using the Next.js cookies helper directly.
// This matches the expected type for the latest @supabase/ssr.
function sb() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies } // <-- IMPORTANT: pass the function from 'next/headers'
  );
}

/**
 * GET /api/requests/:id/files
 * Returns DB rows + signedUrl generated from Storage path.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = sb();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requestId = params.id;

  const { data, error } = await supabase
    .from('request_files')
    .select('id,name,path,content_type,size,created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const files = await Promise.all(
    (data ?? []).map(async (row) => {
      let signedUrl: string | null = null;
      if (row.path) {
        const { data: sign, error: signErr } = await supabase.storage
          .from('request-files') // bucket name
          .createSignedUrl(row.path, 60 * 10);
        if (!signErr) signedUrl = sign?.signedUrl ?? null;
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
 * FormData: file=<File>
 * Stores file to Storage and inserts a row in request_files.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = sb();

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
  const ext = file.name?.split('.').pop() ?? 'bin';
  const objectPath = `${user.id}/${requestId}/${fileId}.${ext}`;

  // 1) upload to storage
  const { error: upErr } = await supabase.storage
    .from('request-files')
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  // 2) insert metadata row
  const { data: inserted, error: insErr } = await supabase
    .from('request_files')
    .insert({
      id: fileId, // remove if your table auto-generates UUIDs
      request_id: requestId,
      name: file.name || null,
      path: objectPath,
      content_type: file.type || null,
      size: file.size || null,
    })
    .select('id,name,path,content_type,size,created_at')
    .single();

  if (insErr) {
    // rollback storage object if DB insert fails
    await supabase.storage.from('request-files').remove([objectPath]);
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  // 3) signed URL for response
  let signedUrl: string | null = null;
  if (inserted.path) {
    const { data: sign } = await supabase.storage
      .from('request-files')
      .createSignedUrl(inserted.path, 60 * 10);
    signedUrl = sign?.signedUrl ?? null;
  }

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
