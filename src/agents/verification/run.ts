// src/agents/verification/run.ts
import { createClient } from "@supabase/supabase-js";
import { sha256Hex, redact } from "@/lib/crypto/hash";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

type SubjectIdentifiers = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
};

async function getSubject(subjectId: string): Promise<SubjectIdentifiers> {
  const supabase = db();
  const { data, error } = await supabase
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

async function resolveTargetUrl(subjectId: string, controllerId: string | null): Promise<string | null> {
  const supabase = db();
  // Prefer a discovered item URL for this subject+controller
  const { data, error } = await supabase
    .from("discovered_items")
    .select("url")
    .eq("subject_id", subjectId)
    .eq("controller_id", controllerId)
    .is("url", null)
    .not("url", "is", null) // keep TS happy; real filter is next line
    .limit(1);

  // Supabase doesn't allow both eq null and not null in same chain; do a simpler query:
  if (error) {
    const { data: fallback } = await supabase
      .from("discovered_items")
      .select("url")
      .eq("subject_id", subjectId)
      .eq("controller_id", controllerId)
      .limit(1);
    return (fallback?.[0]?.url as string) ?? null;
  }
  return (data?.[0]?.url as string) ?? null;
}

function containsIdentifier(html: string, subject: SubjectIdentifiers) {
  const hay = html.toLowerCase();
  const tests: string[] = [];
  if (subject.email) tests.push(subject.email.toLowerCase());
  if (subject.phone) {
    const digits = subject.phone.replace(/[^\d]/g, "");
    if (digits) {
      tests.push(digits);
      // also test last 6 digits for partials
      if (digits.length >= 6) tests.push(digits.slice(-6));
    }
  }
  if (subject.name) tests.push(subject.name.toLowerCase());
  return tests.some((t) => t && hay.includes(t));
}

export async function verifyActionPost(action: {
  id: string;
  subject_id: string;
  controller_id: string | null;
  to: string | null;
}): Promise<{
  dataFound: boolean;
  confidence: number;
  evidence: any;
}> {
  const supabase = db();
  const url =
    (await resolveTargetUrl(action.subject_id, action.controller_id)) ||
    action.to ||
    null;

  const subject = await getSubject(action.subject_id);

  if (!url) {
    return {
      dataFound: false,
      confidence: 0.3,
      evidence: { reason: "no_url_to_check", subject: { email: redact(subject.email), phone: redact(subject.phone) } },
    };
  }

  let html = "";
  let ok = false;
  try {
    const res = await fetch(url, { method: "GET" });
    ok = res.ok;
    html = ok ? await res.text() : "";
  } catch (e: any) {
    return {
      dataFound: false,
      confidence: 0.2,
      evidence: { fetchError: String(e?.message || e), url },
    };
  }

  // heuristic: presence in HTML => found
  const found = ok && containsIdentifier(html, subject);
  const confidence = found ? 0.9 : 0.7;
  const evidence = {
    url,
    status: ok ? "ok" : "http_error",
    hash: sha256Hex(html),
    // redact identifiers so we don't leak PII in logs
    identifiers_checked: {
      email: redact(subject.email),
      phone: redact(subject.phone),
      name: subject.name ? "[present]" : null,
    },
  };

  // Insert into verifications
  const { error: insErr } = await supabase.from("verifications").insert({
    action_id: action.id,
    subject_id: action.subject_id,
    controller_id: action.controller_id,
    data_found: found,
    confidence,
    evidence_artifacts: { post: evidence },
    next_verification_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (insErr) throw new Error(`[verify] insert verifications failed: ${insErr.message}`);

  return { dataFound: found, confidence, evidence };
}
