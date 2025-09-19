import { NextResponse } from 'next/server';

export const config = {
  matcher: ['/dashboard'],
};

export function middleware() {
  // Client-side guard handles redirect; keeping middleware minimal for edge simplicity.
  return NextResponse.next();
}
