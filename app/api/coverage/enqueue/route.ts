import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const { userId, orgId, siteId, identity } = await req.json()

  await supabase.from('site_accounts')
    .insert([{ org_id: orgId, site_id: siteId, identity }])
    .select().maybeSingle()

  const { data: job, error } = await supabase.from('removal_jobs')
    .insert([{ org_id: orgId, site_id: siteId, status: 'queued', payload: { identity } }])
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('removal_events')
    .insert([{ job_id: job.id, type: 'queued', message: 'Job queued', meta: { by: userId } }])

  return NextResponse.json({ ok: true, jobId: job.id })
}
