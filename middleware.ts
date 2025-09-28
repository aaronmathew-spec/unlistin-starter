// middleware.ts — pass-through (no external packages)
import { NextResponse } from 'next/server'

export function middleware() {
  return NextResponse.next()
}

// Limit it to protected areas only (adjust as needed)
export const config = {
  matcher: ['/dashboard/:path*', '/requests/:path*'],
}
