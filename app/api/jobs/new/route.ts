import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { orgId, personId, source, payload } = await req.json()

  if (!orgId || !personId || !source) {
    return NextResponse.json({ error: 'orgId, personId, source required' }, { status: 400 })
  }

  const { data: job, error } = await supabase
    .from('removal_jobs')
    .insert([{ org_id: orgId, person_id: personId, source, payload, status: 'queued' }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, job })
}
