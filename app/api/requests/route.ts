// app/api/requests/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Minimal server-side Supabase client bound to Next.js cookies
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
          // persist any auth cookie updates coming from Supabase
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    }
  )
}

// Optional: basic input cleanup
function cleanStr(v: unknown, max = 2048) {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length ? s.slice(0, max) : null
}

/**
 * POST /api/requests
 * Create a new removal request for the current signed-in user.
 * Body: { category?: string, removal_url?: string, notes?: string }
 */
export async function POST(req: Request) {
  try {
    const supabase = getSupabase()

    // Must be signed in
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    // Parse and sanitize body
    const body = await req.json().catch(() => ({} as any))
    const category = cleanStr(body?.category, 128) ?? null
    const removal_url = cleanStr(body?.removal_url, 2048) ?? null
    const notes = cleanStr(body?.notes, 8000) ?? null

    // Insert the request. status defaults to 'new' for convenience.
    const { data, error } = await supabase
      .from('requests')
      .insert({
        user_id: user.id,
        category,
        removal_url,
        notes,
        status: 'new',
      })
      .select('id')
      .single()

    if (error) {
      // If RLS blocks insert (e.g., missing user_id policy), surface a clear message
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ id: data.id })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unexpected error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/requests
 * Return the current user’s requests (most recent first).
 */
export async function GET() {
  try {
    const supabase = getSupabase()

    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('requests')
      .select('id, created_at, category, status, notes, removal_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ rows: data ?? [] })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Unexpected error' },
      { status: 500 }
    )
  }
}
