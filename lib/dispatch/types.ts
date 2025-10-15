// lib/dispatch/types.ts
export type Locale = "en" | "hi";

export type SubjectProfile = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ControllerRequestInput = {
  controllerKey:
    | "truecaller"
    | "naukri"
    | "olx"
    | "foundit"
    | "shine"
    | "timesjobs"
    | "generic";
  controllerName: string;
  subject: SubjectProfile;
  locale?: Locale;
};

export type DispatchResult =
  | { ok: true; channel: "email" | "webform" | "app" | "phone"; providerId?: string; note?: string }
  | { ok: false; error: string; hint?: string };
