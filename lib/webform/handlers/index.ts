// lib/webform/handlers/index.ts
import type { WebformHandler, WebformJobInput } from "./types";
import { TruecallerHandler } from "./truecaller";

const REGISTRY: WebformHandler[] = [
  TruecallerHandler,
  // Add more handlers here as you implement them (naukri, olx, etc.)
];

export function pickHandler(job: WebformJobInput): WebformHandler | null {
  const key = job.controllerKey.toLowerCase();
  const url = (job.formUrl || "").toLowerCase();

  // 1) exact controller key match
  const byKey = REGISTRY.find((h) => h.key === key);
  if (byKey) return byKey;

  // 2) domain hint in URL (if provided)
  if (url) {
    const byDomain = REGISTRY.find(
      (h) => h.domains?.some((d) => url.includes(d.toLowerCase()))
    );
    if (byDomain) return byDomain;
  }

  return null;
}

export { REGISTRY };
export type { WebformHandler, WebformJobInput } from "./types";
