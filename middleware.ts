import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // keeps cookies in sync as the user is browsing
  await supabase.auth.getSession()

  // public routes:
  const { pathname } = req.nextUrl
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/api/lead') ||
    pathname.startsWith('/auth/callback')

  if (isPublic) return res

  // everything else requires a session
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: [
    // run on everything under app/, except static files and public assets
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
