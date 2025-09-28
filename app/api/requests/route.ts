// app/api/requests/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type Body = {
  removal_url?: string
  url?: string              // allow either name from the form
  category?: string | null
  notes?: string | null
}

function getServerSupabase() {
  // Create a Supabase client that reads/writes the auth cookies on the server.
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // anon is fine; we rely on RLS
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
    },
  )
}

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase()

    // who is logged in?
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }
    if (!user) {
      return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
    }

    const body: Body = await req.json().catch(() => ({} as Body))
    const removal_url = body.removal_url || body.url
    const category = body.category ?? null
    const notes = body.notes ?? null

    if (!removal_url) {
      return NextResponse.json({ error: 'removal_url is required' }, { status: 400 })
    }

    // Insert with the current user's id
    const { data, error } = await supabase
      .from('requests')
      .insert({
        user_id: user.id,
        removal_url,
        category,
        notes,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 })
  }
}
