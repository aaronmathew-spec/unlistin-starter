// src/app/api/verification/run/route.ts
import { NextResponse } from "next/server";
import { capture } from "@/lib/verification/run";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, svc);

export async function POST(req: Request) {
  const { actionId, controllerId, subjectId, url } = await req.json();

  if (!url || !actionId) {
    return NextResponse.json({ error: "Missing url or actionId" }, { status: 400 });
  }

  // Capture baseline evidence
  const pre = await capture(url);

  // (Optional) upload artifacts to Supabase Storage (ensure bucket 'proof-vault' exists)
  // const { data: screenshotPut } = await supabase.storage.from("proof-vault")
  //   .upload(`pre/${actionId}-${Date.now()}.png`, pre.screenshot, { contentType: "image/png", upsert: true });
  // const { data: domPut } = await supabase.storage.from("proof-vault")
  //   .upload(`pre/${actionId}-${Date.now()}.html`, pre.dom, { contentType: "text/html", upsert: true });

  const { data, error } = await supabase.from("verifications").insert({
    action_id: actionId,                 // uuid
    subject_id: subjectId || null,
    controller_id: controllerId || null,
    data_found: true,                    // baseline shows presence
    confidence: 0.99,
    evidence_artifacts: { pre /*, screenshotPath: screenshotPut?.path, domPath: domPut?.path */ },
    next_verification_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7d
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ verification: data });
}
