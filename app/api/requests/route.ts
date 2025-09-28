import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function POST(req: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // read the logged-in user from auth cookies
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Auth session missing' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { site_url, category, notes } = body

  if (!site_url) {
    return NextResponse.json({ error: 'site_url is required' }, { status: 400 })
  }

  // Insert belongs to the current user (user_id is NOT NULL in DB)
  const { data, error } = await supabase
    .from('requests')
    .insert({
      user_id: user.id,
      removal_url: site_url,
      category: category ?? null,
      notes: notes ?? null,
      status: 'new'
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
