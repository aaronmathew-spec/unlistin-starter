// lib/controllers/meta.ts

export type PreferredChannel = "webform" | "email" | "api";

export type ControllerMeta = {
  key: string;
  name: string;
  preferred: PreferredChannel; // default channel (can be overridden in DB)
  formUrl?: string;
  slaTargetMin?: number;
  identity?: {
    wantsName?: boolean;
    wantsEmail?: boolean;
    wantsPhone?: boolean;
    wantsIdDoc?: boolean;
  };
  locales?: Array<"en" | "hi">;
};

/** Authoritative defaults (code). DB overrides merge on top at runtime. */
export const CONTROLLER_DEFAULTS: Record<string, ControllerMeta> = {
  truecaller: {
    key: "truecaller",
    name: "Truecaller",
    preferred: "webform",
    formUrl: "https://www.truecaller.com/privacy-center/request/unlist",
    slaTargetMin: 60,
    identity: { wantsName: true, wantsEmail: true, wantsPhone: true },
    locales: ["en", "hi"],
  },
  naukri: {
    key: "naukri",
    name: "Naukri",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en", "hi"],
  },
  olx: {
    key: "olx",
    name: "OLX",
    preferred: "webform",
    slaTargetMin: 120,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
  },
  foundit: {
    key: "foundit",
    name: "foundit",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
  },
  shine: {
    key: "shine",
    name: "Shine",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
  },
  timesjobs: {
    key: "timesjobs",
    name: "TimesJobs",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
  },
};

export function getDefaultControllerMeta(key: string): ControllerMeta | null {
  const k = (key || "").toLowerCase();
  return CONTROLLER_DEFAULTS[k] ?? null;
}
