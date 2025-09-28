import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

function getSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    }
  )
}

export async function POST(req: Request) {
  const supabase = getSupabase()

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Auth session missing' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { site_url, category, notes } = body
  if (!site_url) {
    return NextResponse.json({ error: 'site_url is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('requests')
    .insert({
      user_id: user.id,
      removal_url: site_url,
      category: category ?? null,
      notes: notes ?? null,
      status: 'new',
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}
