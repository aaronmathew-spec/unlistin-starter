// src/lib/controllers/webforms/enqueue.ts
// Minimal façade for enqueuing a Playwright webform job.
// Non-breaking: right now it only returns a structured stub.
// Swap the internals later to push to your real queue (SQS/Redis/etc).

export const runtime = "nodejs";

export type EnqueueResult =
  | { ok: true; queued: true; queueId?: string; details?: Record<string, unknown> }
  | { ok: false; queued: false; error: string };

export async function enqueueWebformJob(input: {
  controller: "truecaller" | "naukri" | "olx";
  args: Record<string, unknown>;
}): Promise<EnqueueResult> {
  // TODO: Wire to your real queue infra later.
  // For now, return a safe stub so we keep deploys green.
  return {
    ok: true,
    queued: true,
    queueId: undefined, // replace with your job id when wired
    details: {
      controller: input.controller,
      args: input.args,
      note: "Webform job enqueued (stub). Replace enqueueWebformJob() with real queue push.",
    },
  };
}
