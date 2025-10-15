// app/api/proofs/finalize/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { recordSignedRoot } from "@/lib/proofs/ledger";

const OPS_SECRET = process.env.SECURE_CRON_SECRET || "";

function bad(status: number, msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/**
 * POST /api/proofs/finalize
 * Body:
 *  {
 *    rootHex?: string,        // hex-encoded root (preferred)
 *    rootBase64?: string,     // OR base64-encoded root
 *    packId?: string,
 *    subjectId?: string,
 *    controllerKey?: string,
 *    metadata?: object
 *  }
 * Header: x-secure-cron: <SECURE_CRON_SECRET>  (swap to isAdmin() for UI usage)
 */
export async function POST(req: Request) {
  if (!OPS_SECRET) return bad(500, "SECURE_CRON_SECRET not configured");
  const hdr = req.headers.get("x-secure-cron") || "";
  if (hdr !== OPS_SECRET) return bad(403, "forbidden");

  const body = (await req.json().catch(() => ({}))) as any;
  const rootHex = (body?.rootHex || "").toString().trim();
  const rootBase64 = (body?.rootBase64 || "").toString().trim();

  let bytes: Uint8Array | null = null;
  if (rootHex) {
    bytes = Buffer.from(rootHex, "hex");
  } else if (rootBase64) {
    bytes = Buffer.from(rootBase64, "base64");
  }

  if (!bytes || bytes.length === 0) {
    return bad(400, "Provide rootHex or rootBase64");
  }

  const rec = await recordSignedRoot(bytes, {
    packId: body?.packId ?? null,
    subjectId: body?.subjectId ?? null,
    controllerKey: body?.controllerKey ?? null,
    metadata: body?.metadata ?? null,
  });

  return NextResponse.json({ ok: true, record: rec });
}
