import { NextRequest } from "next/server";
import { proofPackResponse } from "@/src/lib/proofs/pack";

export const runtime = "nodejs"; // ensure Node runtime (not edge) for zipping

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");
  if (!subjectId) {
    return new Response("Missing subjectId", { status: 400 });
  }
  try {
    return await proofPackResponse(subjectId);
  } catch (e: any) {
    console.error("proof-pack-export-error", e);
    return new Response("Export failed", { status: 500 });
  }
}
