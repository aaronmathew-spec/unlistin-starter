// middleware.ts (root)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  await supabase.auth.getSession(); // refresh session cookies
  return res;
}

// apply only where you need auth/session
export const config = {
  matcher: ['/', '/requests/:path*', '/dashboard'],
};
