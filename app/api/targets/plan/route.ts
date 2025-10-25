// app/api/targets/plan/route.ts
// Given a subject profile, return a prioritized subset of the target matrix.
// Purely in-memory; no DB. Safe default: returns a quick-start top list.

import { NextResponse } from "next/server";
import { TARGET_MATRIX } from "@/src/lib/targets/matrix";
import type { TargetEntry } from "@/src/lib/targets/types";

export const runtime = "nodejs";

type Profile = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  handles?: string[] | null; // e.g., instagram, x, telegram
  region?: string | null;    // ISO like "IN"
  fastLane?: boolean | null; // intimate/deepfake flow
};

function rank(entry: TargetEntry, p: Profile): number {
  let score = 0;

  // Region fit
  if (!entry.regions || !p.region || entry.regions.includes(p.region) || entry.regions.includes("GLOBAL")) {
    score += 2;
  }

  // Evidence fit by hints
  if (p.phone && entry.requires.includes("phone")) score += 2;
  if (p.email && entry.requires.includes("account-email")) score += 1;
  if ((p.handles?.length || 0) > 0 && entry.requires.includes("handle")) score += 2;

  // Category heuristics
  if (entry.category === "caller-id") score += 4; // high-impact first
  if (entry.category === "people-search") score += 2;
  if (entry.category === "search-index") score += 1;

  // Fast lane bumps social/messaging + search index for visibility
  if (p.fastLane) {
    if (entry.category === "big-social" || entry.category === "india-social" || entry.category === "messaging") {
      score += 3;
    }
    if (entry.category === "search-index") score += 2;
  }

  return score;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const profile: Profile = {
      fullName: body.fullName ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      handles: Array.isArray(body.handles) ? body.handles.map(String) : null,
      region: body.region ?? "IN",
      fastLane: !!body.fastLane,
    };

    const prioritized = TARGET_MATRIX
      .map((e) => ({ entry: e, score: rank(e, profile) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((x) => x.entry);

    // Minimal plan structure the UI/dispatcher can consume
    const plan = prioritized.map((e) => ({
      key: e.key,
      name: e.name,
      category: e.category,
      preferredChannel: e.preferredChannel,
      allowedChannels: e.allowedChannels,
      requires: e.requires,
      notes: e.notes || null,
    }));

    return NextResponse.json({ ok: true, plan, totalCatalog: TARGET_MATRIX.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
