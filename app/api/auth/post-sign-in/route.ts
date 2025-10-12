/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Tables used here (your current schema):
 * - public.organizations (id uuid pk, name text)
 * - public.user_organizations (user_id uuid, org_id uuid, role text, pk (user_id, org_id))
 *
 * Flow:
 * 1) Read current user from Supabase session (anon client).
 * 2) If user already has a membership → pick most recent org.
 * 3) Else try match org by email domain (name == domain).
 * 4) Else create a Personal Org and add user as owner.
 * 5) Set org_id cookie and return { ok, org_id, mode }.
 */

function supaAuthFromCookies() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => jar.get(key)?.value,
      },
    }
  );
}

function supaService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(_req: NextRequest) {
  try {
    // 1) Who am I?
    const auth = supaAuthFromCookies();
    const { data: uData, error: uErr } = await auth.auth.getUser();
    if (uErr || !uData?.user) {
      return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
    }

    const user = uData.user;
    const userId = user.id;
    const email = (user.email || "").trim();
    const domain = email.includes("@") ? email.split("@")[1]!.toLowerCase() : "";
    const displayName =
      (user.user_metadata?.name as string | undefined) ||
      (user.user_metadata?.full_name as string | undefined) ||
      (email ? email.split("@")[0] : "Personal");

    const db = supaService();

    // 2) If user already has an org, reuse the latest
    const { data: memberships, error: mErr } = await db
      .from("user_organizations")
      .select("org_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (mErr) {
      return NextResponse.json({ ok: false, error: mErr.message }, { status: 500 });
    }

    let orgId: string | null = memberships?.[0]?.org_id ?? null;
    let mode: "existing-membership" | "domain-joined" | "personal-created" | "domain-created" | "noop" = "noop";

    // 3) If none, try to match domain → organizations.name == domain
    if (!orgId && domain) {
      const { data: byDomain, error: dErr } = await db
        .from("organizations")
        .select("id")
        .eq("name", domain)
        .limit(1);
      if (dErr) {
        return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
      }

      if (byDomain && byDomain.length) {
        orgId = byDomain[0]!.id as string;

        // Add membership (admin if someone already there, else owner)
        const { data: anyMember, error: amErr } = await db
          .from("user_organizations")
          .select("user_id")
          .eq("org_id", orgId)
          .limit(1);

        if (amErr) {
          return NextResponse.json({ ok: false, error: amErr.message }, { status: 500 });
        }

        const role = anyMember && anyMember.length > 0 ? "admin" : "owner";
        const { error: addErr } = await db
          .from("user_organizations")
          .insert([{ user_id: userId, org_id: orgId, role }])
          .select("user_id")
          .maybeSingle();
        if (addErr && !addErr.message.includes("duplicate key")) {
          return NextResponse.json({ ok: false, error: addErr.message }, { status: 500 });
        }
        mode = "domain-joined";
      }
    }

    // 4) If still none, create a Personal Org and add membership
    if (!orgId) {
      const personalName = `${displayName} (Personal)`;

      // Insert org if not exists by name (avoid ON CONFLICT, which may not exist)
      let newOrgId: string | null = null;

      const { data: existsByName, error: exErr } = await db
        .from("organizations")
        .select("id")
        .eq("name", personalName)
        .limit(1);
      if (exErr) {
        return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
      }

      if (existsByName && existsByName.length) {
        newOrgId = existsByName[0]!.id as string;
      } else {
        const { data: insOrg, error: insErr } = await db
          .from("organizations")
          .insert([{ name: personalName }])
          .select("id")
          .maybeSingle();
        if (insErr) {
          return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
        }
        newOrgId = insOrg?.id ?? null;
      }

      if (!newOrgId) {
        return NextResponse.json({ ok: false, error: "Failed to create or resolve personal org" }, { status: 500 });
      }

      const { error: uoErr } = await db
        .from("user_organizations")
        .insert([{ user_id: userId, org_id: newOrgId, role: "owner" }])
        .select("user_id")
        .maybeSingle();
      if (uoErr && !uoErr.message.includes("duplicate key")) {
        return NextResponse.json({ ok: false, error: uoErr.message }, { status: 500 });
      }

      orgId = newOrgId;
      mode = "personal-created";
    }

    // If the user had an existing membership from step (2)
    if (mode === "noop" && orgId) {
      mode = "existing-membership";
    }

    // 5) Set the org cookie so the rest of the app scopes correctly
    const res = NextResponse.json({ ok: true, org_id: orgId, mode, domain: domain || null });
    if (orgId) {
      res.cookies.set({
        name: "org_id",
        value: orgId,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "post-sign-in failed" }, { status: 500 });
  }
}
