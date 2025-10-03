// lib/flags.ts 

// ===== Your existing flags (unchanged API) =====
export const FEATURE_AI_UI =
  (process.env.NEXT_PUBLIC_FEATURE_AI ?? "0") === "1";

export const FEATURE_AI_SERVER =
  (process.env.FEATURE_AI_SERVER ?? "0") === "1";

export const FEATURE_AGENTS_UI =
  (process.env.NEXT_PUBLIC_FEATURE_AGENTS ?? "0") === "1";

export const FEATURE_AGENTS_SERVER =
  (process.env.FEATURE_AGENTS_SERVER ?? "0") === "1";

// ===== New flags (opt-in) =====
// Master switch for the server-side automation pipeline (auto/prepare/submit/followups)
export const AUTO_RUN_ENABLED =
  (process.env.AUTO_RUN_ENABLED ?? "1") !== "0"; // default ON

// Customer UI: if you ever want to show buttons again, this can control it.
// Use NEXT_PUBLIC_ if you’ll read this in client components. For now, we keep it server-only.
export const CUSTOMER_BUTTONS_MINIMAL =
  (process.env.CUSTOMER_BUTTONS_MINIMAL ?? "1") !== "0"; // default ON

// Admin-only experiments
export const ADMIN_EXPERIMENTS =
  (process.env.ADMIN_EXPERIMENTS ?? "0") === "1";

// ===== Optional convenience accessor for server code =====
export type Flags = {
  FEATURE_AI_UI: boolean;
  FEATURE_AI_SERVER: boolean;
  FEATURE_AGENTS_UI: boolean;
  FEATURE_AGENTS_SERVER: boolean;
  AUTO_RUN_ENABLED: boolean;
  CUSTOMER_BUTTONS_MINIMAL: boolean;
  ADMIN_EXPERIMENTS: boolean;
};

export function flags(): Flags {
  return {
    FEATURE_AI_UI,
    FEATURE_AI_SERVER,
    FEATURE_AGENTS_UI,
    FEATURE_AGENTS_SERVER,
    AUTO_RUN_ENABLED,
    CUSTOMER_BUTTONS_MINIMAL,
    ADMIN_EXPERIMENTS,
  };
}
