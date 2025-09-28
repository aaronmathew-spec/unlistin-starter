// app/api/requests/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Minimal types for clarity
type Body = {
  full_name?: string
  email?: string
  city_state?: string
  removal_url?: string
  notes?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    const { full_name = '', email = '', city_state = '', removal_url = '', notes = '' } = body

    if (!removal_url) return NextResponse.json({ error: 'removal_url is required' }, { status: 400 })
    if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } })

    // 1) Upsert/find the person by email
    const { data: existing, error: findErr } = await supabase
      .from('people')
      .select('id')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    if (findErr) {
      return NextResponse.json({ error: `lookup failed: ${findErr.message}` }, { status: 500 })
    }

    let personId = existing?.id as string | null

    if (!personId) {
      const { data: pRow, error: pErr } = await supabase
        .from('people')
        .insert({ full_name, email, city_state })
        .select('id')
        .single()

      if (pErr) {
        return NextResponse.json({ error: `create person failed: ${pErr.message}` }, { status: 500 })
      }
      personId = pRow.id
    }

    // 2) Insert the removal job
    const payload = {
      person_id: personId,
      status: 'queued',       // your enum should accept this
      source: 'site',
      meta: { removal_url, notes, form_email: email },
    }

    const { data: job, error: jErr } = await supabase
      .from('removal_jobs')
      .insert(payload)
      .select('id, status, created_at')
      .single()

    if (jErr) {
      return NextResponse.json({ error: `create job failed: ${jErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, job })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'unexpected error' }, { status: 500 })
  }
}
