// app/api/auth/magic-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return new NextResponse("email required", { status: 400 });

  const res = new NextResponse(null, { status: 204 }); // we'll set cookies on this response

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

  const origin = req.headers.get("origin") ?? undefined;
  const redirectTo = `${origin ?? ""}/auth/callback`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) return new NextResponse(error.message, { status: 400 });
  return res;
}
