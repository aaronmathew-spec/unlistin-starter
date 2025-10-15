// app/ops/dispatch/auto-action.ts
"use server";

import "server-only";

export async function autoDispatchFromOps(fd: FormData) {
  const controllerKey = String(fd.get("controllerKey") || "").trim();
  const controllerName = String(fd.get("controllerName") || controllerKey).trim();
  const name = String(fd.get("name") || "").trim();
  const email = String(fd.get("email") || "").trim();
  const phone = String(fd.get("phone") || "").trim();
  const locale = (String(fd.get("locale") || "en").trim() === "hi" ? "hi" : "en") as "en" | "hi";
  const formUrl = String(fd.get("formUrl") || "").trim();
  const force = String(fd.get("force") || "") === "on";

  const payload = {
    controllerKey,
    controllerName,
    subject: { name: name || undefined, email: email || undefined, phone: phone || undefined },
    locale,
    force,
    formUrl: formUrl || undefined,
  };

  // Call internal API with secret header
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/pipeline/auto-dispatch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-secure-cron": process.env.SECURE_CRON_SECRET || "",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: false as const, error: data?.error || "auto_dispatch_failed", hint: data?.hint || null };
    }
  const data = await res.json().catch(() => ({}));
  return { ok: true as const, data };
}
