// app/api/requests/[id]/files/[fileId]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
)

type Params = { params: { id: string; fileId: string } }

// DELETE /api/requests/:id/files/:fileId
export async function DELETE(_req: Request, { params }: Params) {
  const requestId = Number(params.id)
  const fileId = Number(params.fileId)
  if (!requestId || !fileId) {
    return NextResponse.json({ error: 'Bad id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('request_files')
    .delete()
    .eq('id', fileId)
    .eq('request_id', requestId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// PATCH /api/requests/:id/files/:fileId
// body: { name: string }
export async function PATCH(req: Request, { params }: Params) {
  const requestId = Number(params.id)
  const fileId = Number(params.fileId)
  if (!requestId || !fileId) {
    return NextResponse.json({ error: 'Bad id' }, { status: 400 })
  }

  const { name } = await req.json().catch(() => ({}))
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('request_files')
    .update({ name })
    .eq('id', fileId)
    .eq('request_id', requestId)
    .select('id, name, size_bytes, url')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ file: data })
}
