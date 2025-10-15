// app/api/ops/webform/job/[id]/pack/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

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
    return new Response("env_missing", { status: 500 });
  }
  const id = (params?.id || "").trim();
  if (!id) return new Response("missing_id", { status: 400 });

  const sb = srv();
  const { data, error } = await sb
    .from("webform_jobs")
    .select(
      "id, created_at, controller_key, controller_name, subject_name, subject_email, subject_phone, draft_subject, draft_body, artifact_html, artifact_screenshot, controller_ticket_id, status, attempts, last_error, form_url"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    return new Response("not_found", { status: 404 });
  }

  const JSZip = await getZip();
  const zip = new JSZip();

  // Metadata (the pack is intended for evidence—PII is expected inside)
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
  if (typeof data.artifact_html === "string" && data.artifact_html.length) {
    zip.file("artifact.html", data.artifact_html);
  }

  if (data.artifact_screenshot) {
    const buf = Buffer.isBuffer(data.artifact_screenshot)
      ? (data.artifact_screenshot as Buffer)
      : Buffer.from(data.artifact_screenshot as any);
    zip.file("screenshot.png", buf);
  }

  // Build the ZIP as a Node Buffer…
  const nodeBuf: Buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  // …and convert it to a plain Uint8Array (BodyInit-compatible)
  const body = Uint8Array.from(nodeBuf);

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="webform_pack_${id}.zip"`,
      "cache-control": "no-store",
    },
  });
}
