import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const dynamic = "force-dynamic"; // prevent prerender

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // We’ll send the user somewhere after exchanging the code.
  // Change to whatever makes sense in your app.
  const redirectTo = "/requests/new";
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: redirectTo },
  });

  if (!code) return res;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // IMPORTANT: cookies is an OBJECT with methods (not a function)
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, options as any);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...(options as any), maxAge: 0 });
        },
      },
    }
  );

  // Create a session from the magic-link code and set cookies on `res`
  try {
    await supabase.auth.exchangeCodeForSession(code);
  } catch {
    // ignore – redirect will still happen
  }

  return res;
}
