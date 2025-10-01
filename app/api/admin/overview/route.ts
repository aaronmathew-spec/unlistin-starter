// app/api/admin/overview/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/auth/rbac";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

async function countTable(db: ReturnType<typeof supa>, table: string): Promise<number | null> {
  try {
    const res = await db.from(table).select("*", { count: "exact", head: true } as any);
    if (typeof res.count === "number") return res.count;
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  // RBAC guard
  const admin = await isAdmin();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const db = supa();
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  // Required
  {
    const c = await countTable(db, "requests");
    if (c !== null) counts.requests = c;
    else errors.push("requests_count_failed");
  }

  // Optional tables — ignore if missing
  for (const t of ["request_events", "evidence", "ai_messages", "feature_flags"]) {
    const c = await countTable(db, t);
    if (c !== null) counts[t] = c;
  }

  return NextResponse.json({ ok: true, counts, errors });
}
