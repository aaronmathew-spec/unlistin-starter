// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Either match everything except Next assets...
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

// ...or, if you only want middleware on app pages you might guard later:
// export const config = { matcher: ['/requests/:path*', '/dashboard/:path*'] };
