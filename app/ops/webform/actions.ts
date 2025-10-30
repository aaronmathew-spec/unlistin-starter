// app/ops/webform/actions.ts
"use server";

import "server-only";
import { redirect } from "next/navigation";
import { requeueJob, cancelJob } from "@/src/lib/webform/dao";

const FLAG_WEBFORM_RETRY = process.env.FLAG_WEBFORM_RETRY === "1";

export async function actionRequeue(fd: FormData) {
  if (!FLAG_WEBFORM_RETRY) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("retry_disabled")}`);
  }
  const id = String(fd.get("id") || "").trim();
  if (!id) redirect(`/ops/webform/queue?err=${encodeURIComponent("missing_id")}`);

  try {
    await requeueJob(id);
    redirect(`/ops/webform/queue?ok=1&note=${encodeURIComponent("requeued")}`);
  } catch (e: any) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent(String(e?.message || e))}`);
  }
}

export async function actionCancel(fd: FormData) {
  if (!FLAG_WEBFORM_RETRY) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent("retry_disabled")}`);
  }
  const id = String(fd.get("id") || "").trim();
  const reason = String(fd.get("reason") || "cancelled_by_operator");
  if (!id) redirect(`/ops/webform/queue?err=${encodeURIComponent("missing_id")}`);

  try {
    await cancelJob(id, reason);
    redirect(`/ops/webform/queue?ok=1&note=${encodeURIComponent("cancelled")}`);
  } catch (e: any) {
    redirect(`/ops/webform/queue?err=${encodeURIComponent(String(e?.message || e))}`);
  }
}
