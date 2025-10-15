// app/api/ops/webform/job/[id]/pack/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Lazy-load JSZip at runtime so build stays lean
async function getZip() {
  // eslint-disable-next-line no-new-func
  const importer = new Function("m", "return import(m);");
  const mod = await importer("jszip");
  return mod.default as typeof import("jszip");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function srv() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return new NextResponse("env_missing", { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return new NextResponse("missing_id", { status: 400 });

  const sb = srv();
  const { data, error } = await sb
    .from("webform_jobs")
    .select("id, created_at, controller_key, controller_name, subject_name, subject_email, subject_phone, draft_subject, draft_body, artifact_html, artifact_screenshot, controller_ticket_id, status, attempts, last_error, form_url")
    .eq("id", id)
    .single();

  if (error || !data) {
    return new NextResponse("not_found", { status: 404 });
  }

  const JSZip = await getZip();
  const zip = new JSZip();

  // Metadata (no PII logs; but pack itself contains subject fields by design)
  const meta = {
    id: data.id,
    created_at: data.created_at,
    controller_key: data.controller_key,
    controller_name: data.controller_name,
    status: data.status,
    attempts: data.attempts,
    last_error: data.last_error,
    controller_ticket_id: data.controller_ticket_id,
    form_url: data.form_url,
    subject: {
      name: data.subject_name || null,
      email: data.subject_email || null,
      phone: data.subject_phone || null,
    },
    draft: {
      subject: data.draft_subject,
      body: data.draft_body,
    },
  };

  zip.file("meta.json", JSON.stringify(meta, null, 2));

  if (data.artifact_html) {
    zip.file("artifact.html", data.artifact_html);
  }
  if (data.artifact_screenshot) {
    // Supabase returns bytea as base64? We stored raw bytea; fetch comes as base64-ish via JS driver.
    // The client returns ArrayBuffer-ish binary; coerce safely:
    const buf = Buffer.from(data.artifact_screenshot as any);
    zip.file("screenshot.png", buf);
  }

  const pkg = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

  return new NextResponse(pkg, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="webform_pack_${id}.zip"`,
      "cache-control": "no-store",
    },
  });
}
