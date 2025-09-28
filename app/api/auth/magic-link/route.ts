// app/api/auth/magic-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic"; // avoid prerendering this route
// export const runtime = "nodejs"; // optional; default is fine on Vercel

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return new NextResponse("email required", { status: 400 });
  }

  // We'll attach auth cookies to this response
  const res = new NextResponse(null, { status: 204 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // IMPORTANT: implement CookieMethods<'server'> exactly
      cookies: () => ({
        get(name: string): string | undefined {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions): void {
          // NextResponse.cookies.set uses CookieSerializeOptions; it's
          // compatible at runtime with Supabase's CookieOptions.
          res.cookies.set(name, value, options as any);
        },
        remove(name: string, options: CookieOptions): void {
          res.cookies.set(name, "", { ...options, maxAge: 0 } as any);
        },
      }),
    }
  );

  const origin = req.headers.get("origin") ?? "";
  const redirectTo = `${origin}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    return new NextResponse(error.message, { status: 400 });
  }

  // 204 No Content; cookies are set on this response
  return res;
}
