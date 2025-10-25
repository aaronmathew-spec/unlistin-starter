// app/api/intake/fastlane/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueWebformJob } from "@/src/lib/webform/queue";
import { pushDLQ } from "@/src/lib/ops/dlq";

const EvidenceSchema = z.object({
  kind: z.enum(["url", "screenshot", "hash"]).optional().default("url"),
  value: z.string().min(1),
});

const BodySchema = z.object({
  subject: z.object({
    fullName: z.string().min(1),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    subjectId: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    handles: z.array(z.string()).optional().default([]),
  }),
  note: z.string().optional().nullable(),
  evidence: z.array(EvidenceSchema).optional().default([]),
  // Optional: pass a controller hint if known; else workers will pick defaults
  controllerKey: z.string().optional().nullable(),
  controllerName: z.string().optional().nullable(),
});

function assertCronOrInternal(req: Request) {
  // For now, allow internal server-only. Harden with a header if you like.
  return true;
}

export async function POST(req: Request) {
  try {
    if (!assertCronOrInternal(req)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "invalid_body", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { subject, note, evidence, controllerKey, controllerName } = parsed.data;

    const payload: any = {
      controllerKey: controllerKey || "generic",
      controllerName: controllerName || "Fast Lane",
      subject: {
        name: subject.fullName,
        email: subject.email ?? undefined,
        phone: subject.phone ?? undefined,
        id: subject.subjectId ?? undefined,
        handle: subject.handles?.[0] ?? undefined,
      },
      locale: (subject.region?.toUpperCase() === "IN" ? "en-IN" : "en-US"),
      draft: {
        subject: "[URGENT] Intimate image / Deepfake Takedown",
        bodyText:
          `This is an urgent request under IT Rules, 2021 (24-hour removal duty) ` +
          `for non-consensual imagery. Subject: ${subject.fullName}. ${note || ""}\n\n` +
          (evidence?.length ? `Evidence:\n${evidence.map((e) => `- ${e.kind}: ${e.value}`).join("\n")}` : ""),
      },
      formUrl: undefined,
      policyArgs: {
        fastLane: true,
        evidence,
      },
    };

    const wf = await enqueueWebformJob(payload);

    return NextResponse.json({
      ok: true,
      id: (wf as any)?.id ?? null,
      note: "fastlane_enqueued_webform",
    });
  } catch (e: any) {
    const msg = String(e?.message || e);
    await pushDLQ({
      channel: "webform",
      controller_key: "generic",
      subject_id: null,
      payload: { reason: "fastlane_enqueue_failed" },
      error_code: "enqueue_failed",
      error_note: msg,
      retries: 0,
    });
    return NextResponse.json({ ok: false, error: "fastlane_enqueue_failed", note: msg }, { status: 500 });
  }
}
