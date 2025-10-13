// src/agents/verification/sweep.ts
import { createClient } from "@supabase/supabase-js";
import { captureAndStoreArtifacts } from "@/agents/verification/capture";
import { buildMerkleRoot, signRoot } from "@/lib/proofs/merkle";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

type SubjectLite = { email: string | null; phone: string | null; name: string | null };

type ActionRow = {
  id: string;
  subject_id: string;
  controller_id: string | null;
  to: string | null;
  channel: "email" | "phone" | "webform" | "api" | "legal_letter" | "portal" | "other";
  status: "draft" | "sent" | "escalate_pending" | "escalated" | "needs_review" | "verified";
  verification_info?: any;
};

function normalizePhoneDigits(phone?: string | null) {
  const d = (phone || "").replace(/[^\d]/g, "");
  return d || null;
}

function containsIdentifier(html: string, subject: SubjectLite) {
  const hay = (html || "").toLowerCase();
  const tests: string[] = [];
  if (subject.email) tests.push(subject.email.toLowerCase());
  if (subject.name) tests.push(subject.name.toLowerCase());
  if (subject.phone) {
    const d = normalizePhoneDigits(subject.phone);
    if (d) {
      tests.push(d);
      if (d.length >= 6) tests.push(d.slice(-6));
    }
  }
  return tests.some((t) => t && hay.includes(t));
}

async function getSubject(subjectId: string): Promise<SubjectLite> {
  const { data, error } = await db
    .from("subjects")
    .select("email, phone_number, legal_name")
    .eq("id", subjectId)
    .single();
  if (error) throw new Error(`[verify] subject fetch failed: ${error.message}`);
  return {
    email: (data as any)?.email ?? null,
    phone: (data as any)?.phone_number ?? null,
    name: (data as any)?.legal_name ?? null,
  };
}

async function resolveTargetUrl(subjectId: string, controllerId: string | null, fallbackTo: string | null) {
  if (!controllerId) return fallbackTo;
  const { data, error } = await db
    .from("discovered_items")
    .select("url")
    .eq("subject_id", subjectId)
    .eq("controller_id", controllerId)
    .not("url", "is", null)
    .limit(1);
  if (!error && data && data[0]?.url) return data[0].url as string;
  return fallbackTo;
}

async function collectVerificationHashes(subjectId: string) {
  const { data, error } = await db
    .from("verifications")
    .select("evidence_artifacts")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`[verify] verifications load failed: ${error.message}`);
  const hashes: string[] = [];
  for (const v of (data || []) as any[]) {
    const post = v?.evidence_artifacts?.post || {};
    if (typeof post.htmlHash === "string" && post.htmlHash.length > 0) hashes.push(post.htmlHash);
    if (typeof post.screenshotHash === "string" && post.screenshotHash.length > 0) hashes.push(post.screenshotHash);
  }
  return Array.from(new Set(hashes));
}

/**
 * Verify actions for a specific subject (preferred path used by supervisor and API).
 */
export async function verifyDueForSubject(subjectId: string) {
  const subject = await getSubject(subjectId);

  const { data, error } = await db
    .from("actions")
    .select("*")
    .eq("subject_id", subjectId)
    .in("status", ["sent", "escalated", "escalate_pending", "needs_review"])
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(`[verify] actions load failed: ${error.message}`);

  const actions = (data || []) as ActionRow[];

  for (const a of actions) {
    const url = await resolveTargetUrl(a.subject_id, a.controller_id, a.to);
    if (!url) {
      await db.from("verifications").insert({
        action_id: a.id,
        subject_id: a.subject_id,
        controller_id: a.controller_id,
        data_found: false,
        confidence: 0.3,
        evidence_artifacts: { post: { reason: "no_url" } },
      });
      await db.from("actions").update({ status: "verified" }).eq("id", a.id);
      continue;
    }

    // Capture artifacts (screenshot + raw HTML persisted by capture layer)
    const cap = await captureAndStoreArtifacts({
      subjectId: a.subject_id,
      actionId: a.id,
      url,
    });

    // Secondary presence check via direct GET (text match)
    let found = false;
    try {
      const res = await fetch(url, { method: "GET" });
      const html = res.ok ? await res.text() : "";
      found = containsIdentifier(html, subject);
    } catch {
      found = false;
    }

    const evidence = {
      url,
      status: cap.status,
      htmlHash: cap.htmlHash,
      screenshotHash: cap.screenshotHash,
      htmlPath: cap.htmlPath,
      screenshotPath: cap.screenshotPath,
    };

    await db.from("verifications").insert({
      action_id: a.id,
      subject_id: a.subject_id,
      controller_id: a.controller_id,
      data_found: found,
      confidence: found ? 0.9 : 0.8,
      evidence_artifacts: { post: evidence },
    });

    await db
      .from("actions")
      .update({
        status: found ? "needs_review" : "verified",
        verification_info: { ...(a as any).verification_info, post: evidence, observed_present: found },
      })
      .eq("id", a.id);
  }

  // Commit proof for this subject if we have new hashes
  const hashes = await collectVerificationHashes(subjectId);
  if (hashes.length > 0) {
    const { rootHex } = buildMerkleRoot(hashes);
    const signature = await signRoot(rootHex);
    await db.from("proof_ledger").insert({
      subject_id: subjectId,
      merkle_root: rootHex,
      hsm_signature: signature,
      evidence_count: hashes.length,
    });
  }

  return { checked: actions.length };
}

/**
 * Verify all due actions in the system (useful for cron).
 */
export async function verifyAllDue(limit: number = 200) {
  const { data, error } = await db
    .from("actions")
    .select("subject_id")
    .in("status", ["sent", "escalated", "escalate_pending", "needs_review"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`[verify] due subjects list failed: ${error.message}`);
  const subjects = Array.from(new Set((data || []).map((r: any) => r.subject_id as string).filter(Boolean)));

  let total = 0;
  for (const sid of subjects) {
    const res = await verifyDueForSubject(sid);
    total += res.checked || 0;
  }
  return { subjects: subjects.length, actionsChecked: total };
}
