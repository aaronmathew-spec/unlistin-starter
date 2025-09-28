import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // keep cookies in sync
  await supabase.auth.getSession()

  const { pathname } = req.nextUrl
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/api/lead')

  if (isPublic) return res

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
