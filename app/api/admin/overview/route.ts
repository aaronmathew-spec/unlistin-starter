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

export async function GET() {
  // RBAC guard
  const admin = await isAdmin();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const db = supa();

  // Requests count (required)
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  // requests
  {
    const { data, error } = await db.rpc("count_table", { tname: "requests" }).select().maybeSingle()
      .catch(() => ({ data: null, error: { message: "rpc_missing" } } as any));
    if (data && typeof data.count === "number") counts.requests = data.count;
    else {
      // fallback: SELECT count(*)
      const r = await db.from("requests").select("*", { count: "exact", head: true });
      if (r.count != null) counts.requests = r.count;
      else errors.push("requests_count_failed");
    }
  }

  // optional tables
  for (const t of ["request_events", "evidence", "ai_messages", "feature_flags"]) {
    try {
      const r = await db.from(t).select("*", { count: "exact", head: true } as any);
      if (r.count != null) counts[t] = r.count;
    } catch {
      // silently ignore if table missing
    }
  }

  return NextResponse.json({ ok: true, counts, errors });
}
