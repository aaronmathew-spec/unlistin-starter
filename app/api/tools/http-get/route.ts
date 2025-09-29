import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const allowHostsEnv = (process.env.ALLOW_HTTP_GET_HOSTS ?? "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function getSupabaseSSR() {
  const cookieStore = cookies();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (key) => cookieStore.get(key)?.value } }
  );
}

function hostAllowed(url: string) {
  if (allowHostsEnv.length === 0) return false;
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    return allowHostsEnv.some(ah => h === ah || h.endsWith(`.${ah}`));
  } catch {
    return false;
  }
}

// POST { url, headers? } -> { status, textLen }
export async function POST(req: Request) {
  const supabase = getSupabaseSSR();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url ?? "");
  const headers = body?.headers ?? {};

  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
  if (!hostAllowed(url)) return NextResponse.json({ error: "Host not allowed" }, { status: 403 });

  const res = await fetch(url, { method: "GET", headers, redirect: "follow" });
  const text = await res.text();

  return NextResponse.json({ status: res.status, textLen: text.length });
}
