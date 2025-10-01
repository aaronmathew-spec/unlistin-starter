export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Post-sign-in hook:
 * - Derives org by email domain (e.g., "acme.com")
 * - Creates org if missing (UUID id if your orgs.id is uuid)
 * - Upserts membership(user_id, role='owner') if none exists for this org
 * Safe to call multiple times; no-ops if already configured.
 */
function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export async function POST() {
  const db = supa();

  // Who am I?
  const { data: { user }, error: uerr } = await db.auth.getUser();
  if (uerr || !user) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const email = user.email || "";
  const domain = email.split("@")[1]?.toLowerCase() || "";
  if (!domain) {
    return NextResponse.json({ ok: true, note: "No domain; personal account." });
  }

  // Ensure orgs exists (uuid id default)
  try {
    await db.from("orgs").select("id").limit(1);
  } catch {
    // silently ignore; environment may not have orgs (then short-circuit)
    return NextResponse.json({ ok: true, note: "Org model not present; skipped." });
  }

  // Upsert org by name==domain if no exact semantics defined
  let orgId: string | null = null;

  // Try find
  const found = await db.from("orgs").select("id,name").eq("name", domain).maybeSingle();
  if (!found.error && found.data) {
    orgId = (found.data as any).id;
  } else {
    // Try insert
    const ins = await db.from("orgs").insert({ name: domain }).select("id").maybeSingle();
    if (!ins.error && ins.data) orgId = (ins.data as any).id;
  }

  if (!orgId) {
    return NextResponse.json({ ok: true, note: "Could not resolve org id; skipped membership." });
  }

  // Upsert membership (owner if none exist for org)
  const existing = await db.from("org_memberships").select("id,role").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();

  if (!existing.data) {
    // If org has no members yet, make this user owner; else admin
    const anyMember = await db.from("org_memberships").select("id").eq("org_id", orgId).limit(1);
    const role = anyMember.data && anyMember.data.length > 0 ? "admin" : "owner";
    await db.from("org_memberships").insert({ org_id: orgId as any, user_id: user.id, role } as any);
  }

  return NextResponse.json({ ok: true, orgId, domain });
}
