// app/ops/dlq/actions.ts
"use server";

import "server-only";
import { redirect } from "next/navigation";
import { retryDLQ } from "@/lib/ops/dlq";

/**
 * Server action to retry a DLQ item.
 * Uses your existing retry helper; redirects back with query status.
 */
export async function actionRetryDLQ(fd: FormData) {
  const id = String(fd.get("id") || "").trim();
  if (!id) {
    redirect(`/ops/dlq?err=${encodeURIComponent("missing_id")}`);
  }
  try {
    const res = await retryDLQ(id);
    const note =
      (res && (res as any).note) ||
      (res && typeof res === "string" ? res : "enqueued");
    redirect(`/ops/dlq?ok=1&note=${encodeURIComponent(String(note))}`);
  } catch (e: any) {
    redirect(
      `/ops/dlq?err=${encodeURIComponent(String(e?.message || e || "retry_failed"))}`
    );
  }
}
