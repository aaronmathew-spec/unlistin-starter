"use server";

import "server-only";
import { redirect } from "next/navigation";
import { sendControllerRequest } from "@/lib/dispatch/send";

// Server action called by the /ops/dispatch form.
// It reads FormData, invokes your dispatcher, and redirects with a status.
export async function actionSendController(fd: FormData) {
  const controllerKey = String(fd.get("controllerKey") || "").trim();
  const controllerName = String(fd.get("controllerName") || controllerKey).trim();
  const locale = String(fd.get("locale") || "en-IN");

  const subject = {
    id: (fd.get("subjectId") as string) || null,
    name: (fd.get("name") as string) || null,
    email: (fd.get("email") as string) || null,
    phone: (fd.get("phone") as string) || null,
    handle: (fd.get("handle") as string) || null,
  };

  const preferred = String(fd.get("preferred") || "").trim(); // "webform" | "email" | "api" | ""
  const formUrl = (fd.get("formUrl") as string) || null;

  if (!controllerKey) {
    redirect(`/ops/dispatch?err=${encodeURIComponent("controllerKey_required")}`);
  }

  const input: any = {
    controllerKey,
    controllerName,
    subject,
    locale,
    action: "create_request_v1",
    subjectId: subject.id,
  };

  if (preferred === "webform" || preferred === "email" || preferred === "api") {
    input.preferredChannelOverride = preferred;
  }
  if (formUrl) input.formUrl = formUrl;

  const res = await sendControllerRequest(input);

  if (!res.ok) {
    const err = encodeURIComponent(res.error || "dispatch_failed");
    const hint = encodeURIComponent((res as any).hint || "");
    redirect(`/ops/dispatch?err=${err}&hint=${hint}`);
  }

  const chan = encodeURIComponent(res.channel);
  const id = encodeURIComponent(res.providerId || res.note || "");
  redirect(`/ops/dispatch?ok=1&channel=${chan}&id=${id}`);
}
