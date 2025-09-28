import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-only

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { name, email, city_state, org_id = null, source = 'site', meta = {} } = body || {}

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // 1) create person
    const { data: person, error: pErr } = await supabase
      .from('people')
      .insert([{ full_name: name, email, city_state, org_id }])
      .select('id, org_id')
      .single()

    if (pErr) {
      console.error(pErr)
      return NextResponse.json({ error: 'failed to create person' }, { status: 500 })
    }

    // 2) create lead
    const { error: lErr } = await supabase
      .from('leads')
      .insert([{ person_id: person.id, org_id: person.org_id, source, meta }])

    if (lErr) {
      console.error(lErr)
      return NextResponse.json({ error: 'failed to create lead' }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true, person_id: person.id },
      { status: 201 }
    )
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
}

/** Optional: allow a simple GET health check */
export async function GET() {
  return NextResponse.json({ ok: true })
}
