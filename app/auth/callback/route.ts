import { NextResponse, type NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  // Create a Supabase client that can set cookies on the response
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // Supabase will parse code+state from the URL and set the session cookies
  await supabase.auth.exchangeCodeForSession(req.url)

  // Send the user somewhere logged-in (Requests is a good default)
  return NextResponse.redirect(new URL('/requests', req.url))
}
