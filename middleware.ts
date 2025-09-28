// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  // Always create the response first so we can mutate cookies on it
  const res = NextResponse.next();

  // Supabase server client wired to read/write cookies correctly
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Mutate the response cookies (this is what the SSR helper expects)
          res.cookies.set(name, value, options as any);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...(options as any), maxAge: 0 });
        },
      },
    }
  );

  // Optional guard: require auth for protected pages
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = new URL(req.url);
  const needsAuth =
    url.pathname.startsWith("/requests") || url.pathname.startsWith("/dashboard");

  if (!session && needsAuth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

// Only run middleware where we need it (keep auth and static assets public)
export const config = {
  matcher: ["/requests/:path*", "/dashboard"],
};
