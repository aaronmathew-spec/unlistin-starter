/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { serverDB } from "@/lib/server-db";
import { audit } from "@/lib/audit";
import { loadPlaybook, renderBody, template } from "@/lib/playbooks";

function envBool(v?: string) { return v === "1" || v?.toLowerCase() === "true"; }

export async function POST(req: NextRequest) {
  try {
    if (!envBool(process.env.FEATURE_REMOVAL)) {
      return NextResponse.json({ error: "removal feature disabled" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({})) as {
      request_id: number;
      site_id: string;               // e.g., "justdial"
      vars: Record<string, string>;  // { fullName, email, phone, links, ... }
    };

    if (!body.request_id || !body.site_id) {
      return NextResponse.json({ error: "request_id and site_id required" }, { status: 400 });
    }

    const playbook = loadPlaybook(body.site_id);
    if (!playbook || !playbook.email) {
      return NextResponse.json({ error: `playbook not found or not email-enabled: ${body.site_id}` }, { status: 400 });
    }

    // Validate required fields
    const missing = (playbook.required_fields ?? []).filter((k) => !body.vars?.[k]);
    if (missing.length) {
      return NextResponse.json({ error: `missing fields: ${missing.join(", ")}` }, { status: 400 });
    }

    // Compose email from playbook
    const subject = template(playbook.email.subject, body.vars);
    const text = renderBody(playbook.email.body, body.vars);

    // Send via internal tool (keeps SMTP config in one place)
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/tools/email-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: playbook.email.to,
        cc: playbook.email.cc ?? [],
        subject,
        text
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: "email-send failed", detail: err }, { status: 500 });
    }
    const { messageId } = await res.json();

    // Log agent run + evidence
    const db = serverDB();
    const orgId = null; // if you add org scoping later, set it here

    const { data: runRows, error: runErr } = await db
      .from("agent_runs")
      .insert([{
        org_id: orgId,
        type: "removal",
        status: "completed",
        input_json: { request_id: body.request_id, site_id: body.site_id, vars: body.vars },
        output_json: { channel: "email", to: playbook.email.to, messageId },
      }])
      .select("id")
      .limit(1);

    if (runErr) {
      console.error("agent_runs insert error", runErr);
    }

    if (playbook.evidence_rules?.store_message_id) {
      const { error: evErr } = await db.from("evidence").insert([{
        org_id: orgId,
        request_id: body.request_id,
        kind: "email_message_id",
        url: `message:${messageId}`,
        hash: null,
        meta: {
          site_id: body.site_id,
          to: playbook.email.to,
          cc: playbook.email.cc ?? [],
          subject
        }
      }]);
      if (evErr) console.error("evidence insert error", evErr);
    }

    audit("removal.submit", { request_id: body.request_id, site_id: body.site_id, messageId });
    return NextResponse.json({ ok: true, request_id: body.request_id, site_id: body.site_id, messageId });
  } catch (e: any) {
    console.error("removal.submit error", e);
    return NextResponse.json({ error: e?.message ?? "removal submit failed" }, { status: 500 });
  }
}
