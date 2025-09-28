// app/middleware.ts
import { NextResponse } from 'next/server';

export function middleware() {
  return NextResponse.next();
}

// You can keep or remove this; leaving it is fine when middleware always next()s.
export const config = {
  matcher: ['/requests/:path*', '/dashboard'],
};
