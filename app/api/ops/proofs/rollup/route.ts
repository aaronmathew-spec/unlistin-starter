/* app/api/ops/proofs/rollup/route.ts
 * POST (ops-only): compute Merkle root for receipts created today and upsert into ops_merkle_roots.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sha256Hex } from "@/src/lib/crypto/receipts";

const OPS = (process.env.SECURE_CRON_SECRET || "").trim();
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SR = process.env.SUPABASE_SERVICE_ROLE || "";

function forbid(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 403 });
}

function merkleRoot(leaves: string[]): string | null {
  if (leaves.length === 0) return null;
  let level = leaves.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : a; // duplicate last if odd
      next.push(sha256Hex(a + ":" + b));
    }
    level = next;
  }
  return level[0] || null;
}

export async function POST(req: Request) {
  const hdr = (req.headers.get("x-secure-cron") || "").trim();
  if (!OPS) return forbid("secret_not_configured");
  if (hdr !== OPS) return forbid("invalid_secret");

  const sb = createClient(URL, SR, { auth: { persistSession: false } });

  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");
  const dayStr = `${y}-${m}-${d}`; // UTC date

  // Pull today's receipts
  const { data, error } = await sb
    .from("ops_artifact_receipts")
    .select("job_id, html_sha256, screenshot_sha256, created_at")
    .gte("created_at", `${dayStr}T00:00:00.000Z`)
    .lte("created_at", `${dayStr}T23:59:59.999Z`);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = data || [];
  const leaves = rows.map((r) =>
    sha256Hex(`${r.job_id}:${r.html_sha256 || ""}:${r.screenshot_sha256 || ""}`)
  );
  const root = merkleRoot(leaves);
  if (!root) {
    // Upsert empty day root as a no-op record (optional)
    return NextResponse.json({ ok: true, day: dayStr, merkle_root: null, leaf_count: 0 });
  }

  const { error: upErr } = await sb
    .from("ops_merkle_roots")
    .upsert(
      {
        day: dayStr,
        merkle_root: root,
        leaf_count: leaves.length,
      },
      { onConflict: "day" }
    );

  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, day: dayStr, merkle_root: root, leaf_count: leaves.length });
}
