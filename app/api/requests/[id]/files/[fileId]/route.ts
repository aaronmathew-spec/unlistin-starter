// app/api/requests/[id]/files/[fileId]/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
const BUCKET = 'request-files'

function srv() {
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

// DELETE: remove file record + storage object
export async function DELETE(
  req: Request,
  ctx: { params: { id: string; fileId: string } }
) {
  try {
    const requestId = Number(ctx.params.id)
    const fileId = Number(ctx.params.fileId)
    if (!requestId || !fileId) {
      return NextResponse.json({ error: 'Bad id' }, { status: 400 })
    }

    const supabase = srv()

    // 1) Read path from DB so we know what to delete in storage
    const { data: row, error: selErr } = await supabase
      .from('request_files')
      .select('path')
      .eq('id', fileId)
      .eq('request_id', requestId)
      .single()

    if (selErr) throw selErr
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // 2) Delete storage object
    const storage = supabase.storage.from(BUCKET)
    const { error: delObjErr } = await storage.remove([row.path])
    if (delObjErr) throw delObjErr

    // 3) Delete DB row
    const { error: delRowErr } = await supabase
      .from('request_files')
      .delete()
      .eq('id', fileId)
      .eq('request_id', requestId)

    if (delRowErr) throw delRowErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Delete failed' }, { status: 500 })
  }
}
