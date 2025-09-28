// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  // This response will be returned by default unless we redirect below
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: () => ({
        get(name: string): string | undefined {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions): void {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions): void {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      }),
    }
  );

  const { data } = await supabase.auth.getUser();

  const isProtected =
    req.nextUrl.pathname.startsWith("/requests") ||
    req.nextUrl.pathname.startsWith("/dashboard");

  if (isProtected && !data.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set(
      "next",
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  // protect these paths
  matcher: ["/requests/:path*", "/dashboard"],
};
