// lib/webform/handlers/index.ts
import type { WebformHandler, WebformJobInput } from "./types";
import { TruecallerHandler } from "./truecaller";
import { NaukriHandler } from "./naukri";
import { OlxHandler } from "./olx";
import { FounditHandler } from "./foundit";
import { ShineHandler } from "./shine";
import { TimesJobsHandler } from "./timesjobs";

const REGISTRY: WebformHandler[] = [
  TruecallerHandler,
  NaukriHandler,
  OlxHandler,
  FounditHandler,
  ShineHandler,
  TimesJobsHandler,
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
