// src/app/api/proofs/pack/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabaseServer";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key =
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient(url, key, { auth: { persistSession: false } });

const InputSchema = z.object({
  subjectId: z.string().uuid(),
});

type ProofRow = {
  id: string;
  subject_id: string;
  merkle_root: string;
  hsm_signature: string | null;
  evidence_count: number | null;
  arweave_tx_id: string | null;
  created_at: string;
};

type ActionRow = {
  id: string;
  subject_id: string;
  controller_id: string | null;
  to: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  verification_info: any | null;
};

type VerificationRow = {
  id: string;
  action_id: string;
  subject_id: string;
  controller_id: string | null;
  data_found: boolean | null;
  confidence: number | null;
  evidence_artifacts: any | null; // {post:{htmlHash,screenshotHash,htmlPath,screenshotPath,url,status}}
  created_at: string;
};

type SubjectRow = {
  id: string;
  user_id: string;
  email: string | null;
  phone_number: string | null;
  legal_name: string | null;
  created_at?: string | null;
};

function htmlEscape(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderReportHTML(opts: {
  subject: SubjectRow;
  proofs: ProofRow[];
  actions: ActionRow[];
  verifications: VerificationRow[];
}) {
  const { subject, proofs, actions, verifications } = opts;

  const lastProof = proofs[0];
  const idLine =
    [subject.legal_name, subject.email, subject.phone_number]
      .filter(Boolean)
      .join(" • ") || subject.id;

  const rows = actions.map((a) => {
    const v = verifications.find((x) => x.action_id === a.id);
    const present = v?.data_found ? "Present" : "Removed/Not Observed";
    const conf = v?.confidence != null ? Math.round((v.confidence as number) * 100) + "%" : "—";
    const url = v?.evidence_artifacts?.post?.url ?? a.to ?? "—";
    const h = v?.evidence_artifacts?.post?.htmlHash ?? "—";
    const s = v?.evidence_artifacts?.post?.screenshotHash ?? "—";
    const st = a.status ?? "—";
    return `
      <tr>
        <td class="mono">${htmlEscape(a.id)}</td>
        <td>${htmlEscape(st)}</td>
        <td>${htmlEscape(present)}</td>
        <td>${htmlEscape(conf)}</td>
        <td class="mono">${htmlEscape(url)}</td>
        <td class="mono">${htmlEscape(h)}</td>
        <td class="mono">${htmlEscape(s)}</td>
      </tr>`;
  }).join("");

  const proofsBlock = proofs.map((p) => {
    return `
      <div class="proof">
        <div><b>Merkle Root:</b> <span class="mono">${htmlEscape(p.merkle_root)}</span></div>
        <div><b>Signature:</b> <span class="mono">${htmlEscape(p.hsm_signature ?? "—")}</span></div>
        <div><b>Artifacts:</b> ${p.evidence_count ?? 0}</div>
        ${p.arweave_tx_id ? `<div><b>Anchor:</b> <span class="mono">${htmlEscape(p.arweave_tx_id)}</span></div>` : ""}
        <div><b>Committed at:</b> ${htmlEscape(p.created_at)}</div>
      </div>
    `;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Proof Pack – Subject ${htmlEscape(subject.id)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto; padding: 24px; color: #0f172a; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 24px 0 8px; }
    .sub { color: #64748b; }
    .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 16px; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-top: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; word-break: break-all; }
    .proof { padding: 10px 0; border-top: 1px dashed #e5e7eb; }
    .grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 12px; }
  </style>
</head>
<body>
  <h1>UnlistIN – Proof Pack</h1>
  <div class="sub">Subject: ${htmlEscape(idLine)} (${htmlEscape(subject.id)})</div>

  <div class="card">
    <h2>Cryptographic Commitments</h2>
    ${proofsBlock || "<div class='sub'>No proof ledger entries yet.</div>"}
  </div>

  <div class="card">
    <h2>Verification Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Action ID</th>
          <th>Status</th>
          <th>Observed</th>
          <th>Confidence</th>
          <th>URL</th>
          <th>HTML Hash</th>
          <th>Screenshot Hash</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="7" class="sub">No actions or verifications found.</td></tr>`}
      </tbody>
    </table>
  </div>

  <div class="sub" style="margin-top:24px;">
    ${lastProof ? `Signed root ${htmlEscape(lastProof.merkle_root)} with signature ${htmlEscape(lastProof.hsm_signature ?? "—")}` : "No signature present yet."}
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  try {
    // auth
    const supa = getServerSupabase();
    const {
      data: { user },
      error: authErr,
    } = await supa.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // input
    const { searchParams } = new URL(req.url);
    const parsed = InputSchema.safeParse({ subjectId: searchParams.get("subjectId") });
    if (!parsed.success) {
      return NextResponse.json({ error: "subjectId (uuid) required" }, { status: 400 });
    }
    const subjectId = parsed.data.subjectId;

    // ownership check
    const { data: subject, error: sErr } = await db
      .from("subjects")
      .select("id,user_id,email,phone_number,legal_name,created_at")
      .eq("id", subjectId)
      .single();
    if (sErr || !subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    if (subject.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // load proofs
    const { data: proofs } = await db
      .from("proof_ledger")
      .select("*")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(10);

    // load actions
    const { data: actions } = await db
      .from("actions")
      .select("id,subject_id,controller_id,to,status,created_at,updated_at,verification_info")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: true })
      .limit(500);

    // load verifications (latest 500)
    const { data: verifications } = await db
      .from("verifications")
      .select("id,action_id,subject_id,controller_id,data_found,confidence,evidence_artifacts,created_at")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(500);

    // manifest
    const manifest = {
      generatedAt: new Date().toISOString(),
      subject: {
        id: subject.id,
        name: subject.legal_name,
        email: subject.email,
        phone: subject.phone_number,
        createdAt: subject.created_at ?? null,
      },
      proofs: (proofs ?? []).map((p) => ({
        id: (p as ProofRow).id,
        merkleRoot: (p as ProofRow).merkle_root,
        signature: (p as ProofRow).hsm_signature,
        evidenceCount: (p as ProofRow).evidence_count ?? 0,
        arweaveTxId: (p as ProofRow).arweave_tx_id,
        createdAt: (p as ProofRow).created_at,
      })),
      actions: (actions ?? []).map((a) => ({
        id: (a as ActionRow).id,
        controllerId: (a as ActionRow).controller_id,
        to: (a as ActionRow).to,
        status: (a as ActionRow).status,
        createdAt: (a as ActionRow).created_at,
        updatedAt: (a as ActionRow).updated_at,
        verification: (a as ActionRow).verification_info ?? null,
      })),
      verifications: (verifications ?? []).map((v) => ({
        id: (v as VerificationRow).id,
        actionId: (v as VerificationRow).action_id,
        controllerId: (v as VerificationRow).controller_id,
        dataFound: (v as VerificationRow).data_found,
        confidence: (v as VerificationRow).confidence,
        createdAt: (v as VerificationRow).created_at,
        artifacts: (v as VerificationRow).evidence_artifacts ?? null,
      })),
      signing: proofs && proofs[0]
        ? {
            latestRoot: (proofs[0] as ProofRow).merkle_root,
            latestSignature: (proofs[0] as ProofRow).hsm_signature,
          }
        : null,
      schema: "https://unlistin.io/schemas/proof-pack/v1",
    };

    // HTML report
    const html = renderReportHTML({
      subject: subject as SubjectRow,
      proofs: (proofs ?? []) as ProofRow[],
      actions: (actions ?? []) as ActionRow[],
      verifications: (verifications ?? []) as VerificationRow[],
    });

    // build ZIP
    const zip = new JSZip();
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("report.html", html);

    const blob = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="unlistin-proof-pack-${subjectId}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    console.error("[api/proofs/pack] error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
