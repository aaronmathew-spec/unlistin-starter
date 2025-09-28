import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Touch the session so auth cookies stay valid (important for API routes)
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession();

  return res;
}

// Run on everything except static assets; adjust as needed
export const config = {
  matcher: ['/(?!_next/static|_next/image|favicon.ico).*'],
};
