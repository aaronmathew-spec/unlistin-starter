// app/api/requests/[id]/files/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // server only
const BUCKET = 'request-files'

function srv() {
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

// GET: list files & signed URLs
export async function GET(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const requestId = Number(ctx.params.id)
    if (!requestId) return NextResponse.json({ error: 'Bad id' }, { status: 400 })

    const supabase = srv()

    // list metadata
    const { data: rows, error } = await supabase
      .from('request_files')
      .select('id, name, path, mime, size_bytes, created_at')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // generate signed URLs for each file
    const storage = supabase.storage.from(BUCKET)
    const withUrls = await Promise.all(
      (rows ?? []).map(async (r) => {
        const { data: signed } = await storage.createSignedUrl(r.path, 60 * 10) // 10 min
        return { ...r, url: signed?.signedUrl ?? null }
      })
    )

    return NextResponse.json({ files: withUrls })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 })
  }
}

// POST: upload file (multipart/form-data: file)
// Saves to storage at "<requestId>/<filename>" and records DB metadata
export async function POST(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const requestId = Number(ctx.params.id)
    if (!requestId) return NextResponse.json({ error: 'Bad id' }, { status: 400 })

    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'FormData required' }, { status: 400 })

    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })

    const supabase = srv()
    const storage = supabase.storage.from(BUCKET)

    // create path "<requestId>/<filename>"
    const safeName = file.name.replace(/[^\w.@-]+/g, '_')
    const path = `${requestId}/${Date.now()}_${safeName}`

    const arrayBuf = await file.arrayBuffer()
    const { error: upErr } = await storage.upload(path, arrayBuf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false
    })
    if (upErr) throw upErr

    const { data: inserted, error: insErr } = await supabase
      .from('request_files')
      .insert({
        request_id: requestId,
        path,
        name: file.name,
        mime: file.type || null,
        size_bytes: file.size || null
      })
      .select('id')
      .single()

    if (insErr) throw insErr
    return NextResponse.json({ ok: true, id: inserted.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 })
  }
}
