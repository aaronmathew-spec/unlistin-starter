// app/api/requests/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  // must be logged in
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Auth session missing' }, { status: 401 });
  }

  const body = await req.json();
  const { site_url, category, notes } = body;

  const { error } = await supabase.from('requests').insert({
    user_id: user.id,
    site_url,
    category,
    notes,
    status: 'new',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
