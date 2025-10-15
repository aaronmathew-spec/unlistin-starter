// app/ops/controllers/actions.ts
"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { upsertControllerMeta } from "@/lib/controllers/store";

export async function actionUpsert(fd: FormData) {
  const key = String(fd.get("key") || "").trim().toLowerCase();
  const preferred = String(fd.get("preferred") || "").trim();
  const sla = Number(String(fd.get("slaTargetMin") || "0"));
  const formUrl = String(fd.get("formUrl") || "").trim();
  const autoEnabled = String(fd.get("autoDispatchEnabled") || "") === "on";
  const minConfRaw = String(fd.get("autoDispatchMinConf") || "").trim();
  const minConf = minConfRaw ? Number(minConfRaw) : undefined;

  if (!key || (preferred !== "email" && preferred !== "webform" && preferred !== "api") || !Number.isFinite(sla)) {
    throw new Error("invalid_input");
  }
  if (typeof minConf !== "undefined" && !(minConf >= 0 && minConf <= 1)) {
    throw new Error("invalid_conf");
  }

  await upsertControllerMeta({
    key,
    preferred: preferred as any,
    slaTargetMin: sla,
    formUrl: formUrl || undefined,
    autoDispatchEnabled: autoEnabled,
    autoDispatchMinConf: typeof minConf === "number" ? minConf : undefined,
  });

  revalidatePath("/ops/controllers");
}
