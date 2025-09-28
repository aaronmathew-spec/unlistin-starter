// app/api/auth/magic-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic"; // don't prerender this endpoint
// export const runtime = "nodejs"; // optional, defaults to node on Vercel

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return new NextResponse("email required", { status: 400 });

  // We'll attach cookies to this response
  const res = new NextResponse(null, { status: 204 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Use a wide type for options to satisfy both sides (ssr + NextResponse)
      cookies: () => ({
        get(name: string): string | undefined {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any): void {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: any): void {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
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

  if (error) return new NextResponse(error.message, { status: 400 });
  return res; // 204 No Content
}
