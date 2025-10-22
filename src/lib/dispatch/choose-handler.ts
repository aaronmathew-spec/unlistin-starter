// src/lib/dispatch/choose-handler.ts
import { resolveHandler } from "@/src/lib/controllers/resolve";

export type DispatchTarget =
  | { kind: "email"; to: string; subject?: string | null; meta?: Record<string, any>; label: string }
  | { kind: "webform"; url: string; meta?: Record<string, any>; label: string }
  | { kind: "portal"; url: string; meta?: Record<string, any>; label: string }
  | { kind: "api"; url: string; meta?: Record<string, any>; label: string };

export async function chooseHandler(params: {
  subjectId?: string;
  countryCode: string; // e.g., "IN"
  siteKey: string;     // e.g., "instagram"
}): Promise<DispatchTarget> {
  const r = await resolveHandler(params);
  if (!r) {
    throw new Error(`No handler found for ${params.countryCode}:${params.siteKey}`);
  }

  const label = r.display_name || `${params.countryCode}:${params.siteKey}`;

  switch (r.channel) {
    case "email": {
      const to = (r.email_to || "").trim();
      if (!to) throw new Error("Resolved email handler has no email_to");
      return { kind: "email", to, subject: r.email_subject_template ?? null, meta: r.meta ?? {}, label };
    }
    case "webform":
      if (!r.endpoint_url) throw new Error("Resolved webform handler missing endpoint_url");
      return { kind: "webform", url: r.endpoint_url, meta: r.meta ?? {}, label };
    case "portal":
      if (!r.endpoint_url) throw new Error("Resolved portal handler missing endpoint_url");
      return { kind: "portal", url: r.endpoint_url, meta: r.meta ?? {}, label };
    case "api":
      if (!r.endpoint_url) throw new Error("Resolved api handler missing endpoint_url");
      return { kind: "api", url: r.endpoint_url, meta: r.meta ?? {}, label };
    default:
      throw new Error(`Unsupported channel: ${String((r as any).channel)}`);
  }
}
