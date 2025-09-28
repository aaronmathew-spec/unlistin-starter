import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { name, city_state, email } = body || {}

  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('leads')
    .insert([{ name, city_state, email }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, lead: data }, { status: 201 })
}
