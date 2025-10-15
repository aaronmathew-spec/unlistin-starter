// app/ops/dispatch/actions.ts
"use server";

import "server-only";
import { redirect } from "next/navigation";
import { sendControllerRequest } from "@/lib/dispatch/send";

// Server action called by the /ops/dispatch form.
// It reads FormData, invokes your dispatcher, and redirects with a status.
export async function actionSendController(fd: FormData) {
  const controllerKey = String(fd.get("controllerKey") || "").trim();
  const controllerName = String(fd.get("controllerName") || controllerKey).trim();
  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim();
  const phone = String(fd.get("phone") || "").trim();
  const locale = (String(fd.get("locale") || "en").trim() === "hi" ? "hi" : "en") as "en" | "hi";
  const preferred = String(fd.get("preferred") || "").trim(); // "webform" | "email" | "api" | ""
  const formUrl = String(fd.get("formUrl") || "").trim();

  if (!controllerKey) {
    redirect(`/ops/dispatch?err=${encodeURIComponent("controllerKey_required")}`);
  }

  const input: any = {
    controllerKey,
    controllerName,
    subject: {
      name: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
    },
    locale,
  };

  if (preferred === "webform" || preferred === "email" || preferred === "api") {
    input.preferredChannelOverride = preferred;
  }
  if (formUrl) {
    // Supported by sendControllerRequest (read safely even if not in .d.ts)
    input.formUrl = formUrl;
  }

  const res = await sendControllerRequest(input);

  if (!res.ok) {
    const err = encodeURIComponent(res.error || "dispatch_failed");
    const hint = encodeURIComponent((res as any).hint || "");
    redirect(`/ops/dispatch?err=${err}&hint=${hint}`);
  }

  const chan = encodeURIComponent(res.channel);
  const id = encodeURIComponent((res as any).providerId || (res as any).note || "");
  redirect(`/ops/dispatch?ok=1&channel=${chan}&id=${id}`);
}
