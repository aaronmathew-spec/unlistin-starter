// lib/flags.ts
export const FEATURE_AI_UI =
  (process.env.NEXT_PUBLIC_FEATURE_AI ?? "0") === "1";

export const FEATURE_AI_SERVER =
  (process.env.FEATURE_AI_SERVER ?? "0") === "1";

export const FEATURE_AGENTS_UI =
  (process.env.NEXT_PUBLIC_FEATURE_AGENTS ?? "0") === "1";

export const FEATURE_AGENTS_SERVER =
  (process.env.FEATURE_AGENTS_SERVER ?? "0") === "1";
