// app/ops/webform/queue/actions.ts
"use server";

import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/src/lib/supabase/admin";

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";
const ADMIN_ENABLED = process.env.FLAG_WEBFORM_ADMIN === "1";

/**
 * Requeue: set status=queued, clear error/finished_at; keep attempts as-is.
 */
export async function actionRequeueJob(fd: FormData) {
  if (!ADMIN_ENABLED) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("admin_disabled")}`);
  }
  const id = String(fd.get("id") || "").trim();
  if (!id) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("missing_id")}`);
  }
  const s = supabaseAdmin();
  const { error } = await s
    .from(TABLE)
    .update({ status: "queued", error: null, finished_at: null })
    .eq("id", id);
  if (error) {
    redirect(
      `/ops/webform/queue?err=${encodeURIComponent(
        `requeue_failed:${error.message}`
      )}`
    );
  }
  redirect(`/ops/webform/queue?ok=1&note=${encodeURIComponent("requeued")}`);
}

/**
 * Delete job permanently.
 */
export async function actionDeleteJob(fd: FormData) {
  if (!ADMIN_ENABLED) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("admin_disabled")}`);
  }
  const id = String(fd.get("id") || "").trim();
  if (!id) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("missing_id")}`);
  }
  const s = supabaseAdmin();
  const { error } = await s.from(TABLE).delete().eq("id", id);
  if (error) {
    redirect(
      `/ops/webform/queue?err=${encodeURIComponent(
        `delete_failed:${error.message}`
      )}`
    );
  }
  redirect(`/ops/webform/queue?ok=1&note=${encodeURIComponent("deleted")}`);
}
