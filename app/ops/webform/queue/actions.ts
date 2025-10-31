// app/ops/webform/queue/actions.ts
"use server";

import "server-only";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/src/lib/supabase/admin";

const TABLE = process.env.WEBFORM_JOBS_TABLE || "webform_jobs";
const ADMIN_ENABLED = process.env.FLAG_WEBFORM_ADMIN === "1";

/** Guard: only allow when admin flag is enabled */
function adminGuard() {
  if (!ADMIN_ENABLED) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("admin_disabled")}`);
  }
}

/**
 * Requeue a job:
 * - status -> queued
 * - clear error/result
 * - keep attempts as-is (for honest retry accounting)
 * - clear claimed_at/finished_at/worker_id so it can be claimed again
 */
export async function actionRequeueJob(fd: FormData) {
  adminGuard();

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
        result: null,
        claimed_at: null,
        finished_at: null,
        worker_id: null,
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

/** Permanently delete a job row */
export async function actionDeleteJob(fd: FormData) {
  adminGuard();

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
