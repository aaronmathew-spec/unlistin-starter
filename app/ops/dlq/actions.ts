// app/ops/dlq/actions.ts
"use server";

import "server-only";
import { redirect } from "next/navigation";
import { retryDLQ } from "@/lib/ops/dlq";

/**
 * Server action to retry a DLQ item.
 * Behind feature flag: FLAG_DLQ_RETRY=1
 * Redirects back with query-string status so the UI can show a notice.
 */
export async function actionRetryDLQ(fd: FormData) {
  if (process.env.FLAG_DLQ_RETRY !== "1") {
    redirect(`/ops/dlq?err=${encodeURIComponent("retry_disabled")}`);
  }

  const id = String(fd.get("id") || "").trim();
  if (!id) {
    redirect(`/ops/dlq?err=${encodeURIComponent("missing_id")}`);
  }

  try {
    const res = await retryDLQ(id);
    if (res.ok) {
      const note = (res as any).note || "retry_enqueued";
      redirect(`/ops/dlq?ok=1&note=${encodeURIComponent(String(note))}`);
    } else {
      redirect(`/ops/dlq?err=${encodeURIComponent(String((res as any).error || "retry_failed"))}`);
    }
  } catch (e: any) {
    redirect(`/ops/dlq?err=${encodeURIComponent(String(e?.message || e || "retry_failed"))}`);
  }
}
