// app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  // Where to land after login; tweak as desired
  const next = url.searchParams.get('next') || '/requests';

  const supabase = createRouteHandlerClient({ cookies });

  // Exchange the PKCE code in the URL for a session (sets cookies server-side)
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Redirect the user into the app (session cookies now set)
  return NextResponse.redirect(new URL(next, url.origin));
}
