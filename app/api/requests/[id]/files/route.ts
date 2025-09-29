import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

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
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options, expires: new Date(0) });
        },
      },
    }
  );
}

// GET  /api/requests/:id/files  → list files for a request
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = Number(params.id);
    if (!requestId) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
      .from('request_files')
      // IMPORTANT: ask for "mime"
      .select('id, request_id, name, mime, size_bytes, created_at, path')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ files: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unexpected error' }, { status: 500 });
  }
}

// POST  /api/requests/:id/files  → upload a file and create a DB row
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const requestId = Number(params.id);
    if (!requestId) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const supabase = supabaseServer();

    // (Optional but recommended) put file into a storage bucket
    // Make sure a bucket named "request-files" exists
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const filename = `${Date.now()}_${file.name}`;
    const storagePath = `${requestId}/${filename}`;

    const { data: uploadRes, error: uploadErr } = await supabase.storage
      .from('request-files')
      .upload(storagePath, fileBytes, { contentType: file.type });

    if (uploadErr) {
      // If you do not want storage, you can remove the upload block
      // and only insert a DB row — but then remember path can be ''
      return NextResponse.json({ error: uploadErr.message }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('request_files')
      .insert({
        request_id: requestId,
        path: uploadRes?.path ?? '',    // path can be empty string if you don’t store files
        name: file.name,
        mime: file.type,                // ← store into "mime"
        size_bytes: file.size,
      })
      .select('id, request_id, name, mime, size_bytes, created_at, path')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ file: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unexpected error' }, { status: 500 });
  }
}
