// app/ops/webform/pulse/actions.ts
"use server";

import "server-only";
import { redirect } from "next/navigation";

export async function actionPulseWorker() {
  const secret = (process.env.SECURE_CRON_SECRET || "").trim();
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  if (!secret || !base) {
    redirect(
      `/ops/webform/pulse?err=${encodeURIComponent("missing_SECURE_CRON_SECRET_or_BASE_URL")}`
    );
  }

  try {
    const res = await fetch(`${base}/api/ops/webform/worker`, {
      method: "POST",
      headers: {
        "x-secure-cron": secret,
        "content-type": "application/json",
      },
      // body not required; worker claims N jobs internally
      cache: "no-store",
    });

    let note = "";
    try {
      const j = await res.json();
      note =
        j?.ok
          ? `processed=${j?.processed ?? 0}${j?.note ? `_${j.note}` : ""}`
          : String(j?.error || "worker_error");
    } catch {
      note = res.ok ? "ok" : `http_${res.status}`;
    }

    if (!res.ok) {
      redirect(`/ops/webform/pulse?err=${encodeURIComponent(note)}`);
    }
    redirect(`/ops/webform/pulse?ok=1&note=${encodeURIComponent(note)}`);
  } catch (e: any) {
    redirect(
      `/ops/webform/pulse?err=${encodeURIComponent(String(e?.message || e))}`
    );
  }
}
