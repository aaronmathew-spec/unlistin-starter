// app/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic"; // don't prerender
// (Optional) export const runtime = "nodejs"; // or "edge" if you want edge

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // Where to land the user after exchanging the code for a session.
  const res = NextResponse.redirect(new URL("/requests", req.url));

  // If no code, just continue to the target
  if (!code) return res;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // IMPORTANT: return a function that returns the cookie methods
      cookies: () => ({
        get(name: string): string | undefined {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions): void {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions): void {
          // NextResponse has no "delete", emulate by setting maxAge=0
          res.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      }),
    }
  );

  // Complete the PKCE auth flow
  await supabase.auth.exchangeCodeForSession(code);

  return res;
}
