// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  // This response will be sent forward (and cookies can be attached to it)
  const res = NextResponse.next();

  // Initialize the Supabase client on the edge
  const supabase = createMiddlewareClient({ req, res });

  // IMPORTANT: this call reads/refreshes the session and
  // attaches updated auth cookies to `res` automatically.
  await supabase.auth.getSession();

  return res;
}

// (Exclude static assets so middleware doesn’t run for those)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
