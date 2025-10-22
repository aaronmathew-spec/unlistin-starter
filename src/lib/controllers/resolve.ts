// src/lib/controllers/resolve.ts
import { supabaseAdmin } from "@/src/lib/supabase/admin";

export type ResolvedHandler = {
  controller_id: string;
  display_name: string;
  channel: "email" | "webform" | "portal" | "api";
  endpoint_url?: string | null;
  email_to?: string | null;
  email_subject_template?: string | null;
  meta?: Record<string, any>;
};

export async function resolveHandler(opts: {
  subjectId?: string;
  countryCode: string;  // e.g., "IN", "US"
  siteKey: string;      // e.g., "instagram", "gov-ncii"
}): Promise<ResolvedHandler | null> {
  const { subjectId, countryCode, siteKey } = opts;
  const s = supabaseAdmin();

  // 1) Subject-level overrides?
  if (subjectId) {
    const { data: ov, error: ovErr } = await s
      .from("controller_overrides")
      .select("*")
      .eq("subject_id", subjectId)
      .eq("is_active", true)
      .maybeSingle();
    if (!ovErr && ov) {
      // force by handler id
      if (ov.force_handler_id) {
        const { data: h, error: hErr } = await s
          .from("controller_handlers")
          .select("*, controllers(display_name)")
          .eq("id", ov.force_handler_id)
          .eq("is_active", true)
          .maybeSingle();
        if (!hErr && h) {
          return {
            controller_id: h.controller_id,
            display_name: h.controllers?.display_name || "",
            channel: h.channel,
            endpoint_url: h.endpoint_url,
            email_to: h.email_to,
            email_subject_template: h.email_subject_template,
            meta: h.meta || {}
          };
        }
      }
      // force by channel + controller lookup
      if (ov.force_channel && (ov.country_code || ov.site_key)) {
        const cc = ov.country_code ?? countryCode;
        const sk = ov.site_key ?? siteKey;
        const { data: c, error: cErr } = await s
          .from("controllers")
          .select("id, display_name")
          .eq("country_code", cc)
          .eq("site_key", sk)
          .eq("is_active", true)
          .maybeSingle();
        if (!cErr && c) {
          const { data: h2, error: h2Err } = await s
            .from("controller_handlers")
            .select("*")
            .eq("controller_id", c.id)
            .eq("channel", ov.force_channel)
            .eq("is_active", true)
            .order("priority", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!h2Err && h2) {
            return {
              controller_id: c.id,
              display_name: c.display_name,
              channel: h2.channel,
              endpoint_url: h2.endpoint_url,
              email_to: h2.email_to,
              email_subject_template: h2.email_subject_template,
              meta: h2.meta || {}
            };
          }
        }
      }
    }
  }

  // 2) Default selection by country+site, lowest priority first
  const { data: ctrl, error: ctrlErr } = await s
    .from("controllers")
    .select("id, display_name")
    .eq("country_code", countryCode)
    .eq("site_key", siteKey)
    .eq("is_active", true)
    .maybeSingle();
  if (ctrlErr || !ctrl) return null;

  const { data: handler, error: hErr } = await s
    .from("controller_handlers")
    .select("*")
    .eq("controller_id", ctrl.id)
    .eq("is_active", true)
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (hErr || !handler) return null;

  return {
    controller_id: ctrl.id,
    display_name: ctrl.display_name,
    channel: handler.channel,
    endpoint_url: handler.endpoint_url,
    email_to: handler.email_to,
    email_subject_template: handler.email_subject_template,
    meta: handler.meta || {}
  };
}
