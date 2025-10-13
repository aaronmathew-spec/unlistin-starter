export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseServer";
import { upsertController } from "@/lib/controllers";

const SEED = [
  {
    name: "Truecaller",
    domain: "truecaller.com",
    country: "IN",
    channel_types: ["webform"],
    contact_urls: ["https://www.truecaller.com/privacy-center/request-data-removal"],
    privacy_url: "https://www.truecaller.com/privacy-policy",
    dsar_url: "https://www.truecaller.com/privacy-center/request-data-removal",
    auth_type: "email-verify",
    metadata: { categories: ["caller_id", "directory"] },
  },
  {
    name: "JustDial",
    domain: "justdial.com",
    country: "IN",
    channel_types: ["webform", "email"],
    contact_urls: ["https://www.justdial.com/feedback"],
    privacy_url: "https://www.justdial.com/Privacy-Policy",
    dsar_url: "https://www.justdial.com/feedback",
    auth_type: "captcha",
    metadata: { categories: ["directory"] },
  },
];

export async function POST(_req: NextRequest) {
  // Gate with Supabase session; only logged-in users can seed
  const supa = getServerSupabase();
  const { data: session } = await supa.auth.getUser();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = [];
  for (const c of SEED) {
    // idempotent upsert by name
    const res = await upsertController(c as any);
    results.push(res);
  }
  return NextResponse.json({ seeded: results.length, controllers: results }, { status: 201 });
}
