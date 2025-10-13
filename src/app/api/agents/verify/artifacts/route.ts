// src/app/api/agents/verify/artifacts/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";
import { captureAndStoreArtifacts } from "@/agents/verification/capture";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const Input = z.object({
  subjectId: z.string().uuid(),
  actionId: z.string().uuid().optional(), // if omitted, we’ll process up to N sent/escalate_pending actions
  limit: z.number().int().min(1).max(25).optional(),
});

function normalize(s?: string | null) {
  return s ?? "";
}

function containsIdentifier(haystack: string, subject: { email?: string | null; phone?: string | null; name?: string | null }) {
  const h = haystack.toLowerCase();
  const tests: string[] = [];
  if (subject.email) tests.push(subject.email.toLowerCase());
  if (subject.name) tests.push(subject.name.toLowerCase());
  if (subject.phone) {
    const d = subject.phone.replace(/[^\d]/g, "");
    if (d) {
      tests.push(d);
      if (d.length >= 6) tests.push(d.slice(-6));
    }
  }
  return tests.some((t) => t && h.includes(t));
}

async function resolveTargetUrl(subjectId: string, controllerId: string | null, to: string | null) {
  // prefer discovered_items.url for this subject+controller, else fallback to `to`
  const { data, error } = await db
    .from("discovered_items")
    .select("url")
    .eq("subject_id", subjectId)
    .eq("controller_id", controllerId)
    .not("url", "is", null)
    .limit(1);
  if (!error && data && data[0]?.url) return data[0].url as string;
  return to ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = Input.parse(body);

    // Auth & ownership
    const supa = getServerSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: subj, error: subjErr } = await db
      .from("subjects")
      .select("user_id, email, phone_number, legal_name")
      .eq("id", parsed.subjectId)
      .single();
    if (subjErr || !subj) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    if (subj.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Load actions to verify
    let actions: any[] = [];
    if (parsed.actionId) {
      const { data, error } = await db
        .from("actions")
        .select("id, subject_id, controller_id, to, status")
        .eq("id", parsed.actionId)
        .eq("subject_id", parsed.subjectId)
        .limit(1);
      if (error) throw new Error(`[verify/artifacts] load action failed: ${error.message}`);
      actions = data || [];
    } else {
      const { data, error } = await db
        .from("actions")
        .select("id, subject_id, controller_id, to, status")
        .eq("subject_id", parsed.subjectId)
        .in("status", ["sent", "escalated", "escalate_pending"])
        .order("created_at", { ascending: true })
        .limit(parsed.limit ?? 10);
      if (error) throw new Error(`[verify/artifacts] load actions failed: ${error.message}`);
      actions = data || [];
    }

    if (actions.length === 0) {
      return NextResponse.json({ subjectId: parsed.subjectId, checked: 0, verified: 0, needsReview: 0, artifacts: [] });
    }

    const subject = {
      email: subj.email as string | null,
      phone: subj.phone_number as string | null,
      name: subj.legal_name as string | null,
    };

    let verified = 0;
    let needsReview = 0;
    const artifactsOut: any[] = [];

    for (const a of actions) {
      const targetUrl = await resolveTargetUrl(parsed.subjectId, a.controller_id, a.to);
      if (!targetUrl) {
        // record minimal verification row with reason
        await db.from("verifications").insert({
          action_id: a.id,
          subject_id: parsed.subjectId,
          controller_id: a.controller_id,
          data_found: false,
          confidence: 0.3,
          evidence_artifacts: { post: { reason: "no_url" } },
        });
        await db.from("actions").update({ status: "verified" }).eq("id", a.id);
        verified++;
        continue;
      }

      const cap = await captureAndStoreArtifacts({
        subjectId: parsed.subjectId,
        actionId: a.id,
        url: targetUrl,
      });

      // Basic presence heuristic over HTML only (screenshot hash is for proof)
      const dataFound = cap.ok && containsIdentifier(normalize(cap.htmlHash), subject)
        ? false // never use hash to detect presence
        : false; // real presence check must look at HTML; we avoid downloading again; we can mark unknown->use previous HTML check endpoint if you kept it
      // Re-run a lightweight fetch to check HTML presence (no screenshot)
      let htmlFound = false;
      try {
        const r = await fetch(targetUrl, { method: "GET" });
        const t = r.ok ? await r.text() : "";
        htmlFound = containsIdentifier(t, subject);
      } catch {
        htmlFound = false;
      }

      const finalFound = htmlFound;
      const newStatus = finalFound ? "needs_review" : "verified";
      if (newStatus === "verified") verified++;
      else needsReview++;

      const evidence = {
        url: targetUrl,
        status: cap.status,
        htmlHash: cap.htmlHash,
        screenshotHash: cap.screenshotHash,
        htmlPath: cap.htmlPath,
        screenshotPath: cap.screenshotPath,
      };

      await db.from("verifications").insert({
        action_id: a.id,
        subject_id: parsed.subjectId,
        controller_id: a.controller_id,
        data_found: finalFound,
        confidence: finalFound ? 0.9 : 0.8,
        evidence_artifacts: { post: evidence },
      });

      await db
        .from("actions")
        .update({
          status: newStatus,
          verification_info: {
            post: evidence,
            observed_present: finalFound,
          },
        })
        .eq("id", a.id);

      artifactsOut.push({ actionId: a.id, ...evidence, observed_present: finalFound });
    }

    return NextResponse.json({
      subjectId: parsed.subjectId,
      checked: actions.length,
      verified,
      needsReview,
      artifacts: artifactsOut,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    console.error("[api/agents/verify/artifacts] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
