import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function getServerSupabase() {
  const cookieStore = cookies();

  // Create a Supabase client that reads/writes auth cookies on the server.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // We don't need to set/remove cookies in this endpoint,
        // but @supabase/ssr requires these to exist.
        set() {},
        remove() {},
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabase();

    // Make sure we have a signed-in user (cookies must be present)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 401 });
    }
    if (!user) {
      return NextResponse.json({ error: 'Auth session missing!' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { site_url, category, notes } = body ?? {};

    if (!site_url) {
      return NextResponse.json({ error: 'site_url is required' }, { status: 400 });
    }

    const { error } = await supabase.from('requests').insert({
      site_url,
      category: category ?? null,
      notes: notes ?? null,
      user_id: user.id, // <- critical
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 });
  }
}
