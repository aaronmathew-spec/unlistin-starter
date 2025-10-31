// app/ops/webform/queue/actions.ts
"use server";

import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/src/lib/supabase/admin";

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";
const ADMIN_ENABLED = process.env.FLAG_WEBFORM_ADMIN === "1";

/**
 * Requeue a job:
 * - status -> queued
 * - clear error
 * - keep attempts as-is so retries accounting stays truthful
 * - clear finished_at so it can be picked again
 */
export async function actionRequeueJob(fd: FormData) {
  if (!ADMIN_ENABLED) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("admin_disabled")}`);
  }

  const id = String(fd.get("id") || "").trim();
  if (!id) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("missing_id")}`);
  }

  try {
    const s = supabaseAdmin();
    const { error } = await s
      .from(TABLE)
      .update({
        status: "queued",
        error: null,
        finished_at: null,
      })
      .eq("id", id);

    if (error) {
      redirect(
        `/ops/webform/queue?err=${encodeURIComponent(
          `requeue_failed:${error.message}`
        )}`
      );
    }

    redirect(`/ops/webform/queue?ok=1&note=${encodeURIComponent("requeued")}`);
  } catch (e: any) {
    redirect(
      `/ops/webform/queue?err=${encodeURIComponent(
        String(e?.message || e || "requeue_failed")
      )}`
    );
  }
}

/**
 * Delete a job permanently.
 */
export async function actionDeleteJob(fd: FormData) {
  if (!ADMIN_ENABLED) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("admin_disabled")}`);
  }

  const id = String(fd.get("id") || "").trim();
  if (!id) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("missing_id")}`);
  }

  try {
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
  } catch (e: any) {
    redirect(
      `/ops/webform/queue?err=${encodeURIComponent(
        String(e?.message || e || "delete_failed")
      )}`
    );
  }
}
