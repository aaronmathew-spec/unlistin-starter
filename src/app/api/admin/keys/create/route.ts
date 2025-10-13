export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { generatePAT } from "@/lib/security/pat";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  name: z.string().min(3).max(100),
  scopes: z.array(z.string()).optional(), // e.g. ["runs.create","subjects.create"]
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Input.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.issues }, { status: 400 });

  const supa = getServerSupabase();
  const { data: session } = await supa.auth.getUser();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, prefix, hash } = generatePAT();
  const { error } = await db.from("api_keys").insert({
    user_id: session.user.id,
    name: parsed.data.name,
    prefix,
    hash,
    scopes: parsed.data.scopes ?? [],
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Return the full token ONCE
  return NextResponse.json({ token, prefix }, { status: 201 });
}
