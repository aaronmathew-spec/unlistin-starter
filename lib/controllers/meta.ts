// lib/controllers/meta.ts

export type PreferredChannel = "webform" | "email" | "api";

export type ControllerMeta = {
  key: string;
  name: string;
  preferred: PreferredChannel;
  formUrl?: string;
  slaTargetMin?: number;
  identity?: {
    wantsName?: boolean;
    wantsEmail?: boolean;
    wantsPhone?: boolean;
    wantsIdDoc?: boolean;
  };
  locales?: Array<"en" | "hi">;

  // NEW: auto-dispatch controls (defaults; Ops can override in DB)
  autoDispatchEnabled?: boolean;
  autoDispatchMinConf?: number; // 0..1
};

/** Authoritative defaults; DB overrides merge on top at runtime. */
export const CONTROLLER_DEFAULTS: Record<string, ControllerMeta> = {
  truecaller: {
    key: "truecaller",
    name: "Truecaller",
    preferred: "webform",
    formUrl: "https://www.truecaller.com/privacy-center/request/unlist",
    slaTargetMin: 60,
    identity: { wantsName: true, wantsEmail: true, wantsPhone: true },
    locales: ["en", "hi"],
    autoDispatchEnabled: true,
    autoDispatchMinConf: 0.94,
  },
  naukri: {
    key: "naukri",
    name: "Naukri",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en", "hi"],
    autoDispatchEnabled: false,
    autoDispatchMinConf: 0.95,
  },
  olx: {
    key: "olx",
    name: "OLX",
    preferred: "webform",
    slaTargetMin: 120,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
    autoDispatchEnabled: false,
    autoDispatchMinConf: 0.96,
  },
  foundit: {
    key: "foundit",
    name: "foundit",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
    autoDispatchEnabled: false,
    autoDispatchMinConf: 0.95,
  },
  shine: {
    key: "shine",
    name: "Shine",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
    autoDispatchEnabled: false,
    autoDispatchMinConf: 0.95,
  },
  timesjobs: {
    key: "timesjobs",
    name: "TimesJobs",
    preferred: "email",
    slaTargetMin: 180,
    identity: { wantsName: true, wantsEmail: true },
    locales: ["en"],
    autoDispatchEnabled: false,
    autoDispatchMinConf: 0.95,
  },
};

export function getDefaultControllerMeta(key: string): ControllerMeta | null {
  const k = (key || "").toLowerCase();
  return CONTROLLER_DEFAULTS[k] ?? null;
}
