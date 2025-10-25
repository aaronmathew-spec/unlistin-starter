// src/lib/controllers/registry.ts
/* Controller Registry Facade
   - Wraps your existing defaults (lib/controllers/meta.ts),
     DB overrides (lib/controllers/store.ts),
     and policy synthesizer (src/agents/policy.ts).
   - Presents a stable API for the dispatcher and ops.
*/
import type { ControllerMeta } from "@/lib/controllers/meta";
import { getDefaultControllerMeta } from "@/lib/controllers/meta";
import { loadControllerMeta } from "@/lib/controllers/store";
import type { ControllerPolicy, Channel } from "@/src/agents/policy";
import { synthesizePolicyForController } from "@/src/agents/policy";
import { resolvePolicyByRegion, type LawKey } from "@/src/lib/policy/dsr";

export type ControllerKey =
  | "truecaller"
  | "naukri"
  | "olx"
  | "foundit"
  | "shine"
  | "timesjobs"
  | (string & {}); // allow future

export type RegistryPolicy = ControllerPolicy & {
  meta: ControllerMeta | null;
  // placeholders for future rate & concurrency rules
  rate?: { rpm?: number; burst?: number };
  concurrency?: { max?: number };
};

export async function getControllerMetaMerged(key: ControllerKey): Promise<ControllerMeta | null> {
  const base = getDefaultControllerMeta(key);
  const merged = await loadControllerMeta(key); // DB override
  // loadControllerMeta already merges defaults; keep fallback just in case:
  return merged ?? base;
}

/** Region helper (tenant/subscriber config should map into this eventually) */
export function resolveLaw(regionOrLaw: string | LawKey) {
  return resolvePolicyByRegion(regionOrLaw);
}

/** Main entry: produce a runtime policy (preferred channel + allowed, SLA, artifacts, identity hints). */
export async function getControllerPolicy(
  key: ControllerKey,
  opts?: { region?: string | LawKey }
): Promise<RegistryPolicy | null> {
  const meta = await getControllerMetaMerged(key);
  if (!meta) return null;

  const policy = await synthesizePolicyForController(key);
  const law = opts?.region ? resolvePolicyByRegion(opts.region) : null;

  // lightweight placeholders—wire real limits later from DB or JSON
  const rate = { rpm: 30, burst: 10 };
  const concurrency = { max: 2 };

  return {
    ...policy,
    meta,
    rate,
    concurrency,
  };
}

/** Channel picker: respects preferred → allowed fallback (email → webform or webform → email). */
export function pickNextChannel(
  preferred: Channel,
  allowed: Channel[],
  attempted?: Channel[]
): Channel | null {
  const tried = new Set(attempted ?? []);
  // try preferred first
  if (!tried.has(preferred) && allowed.includes(preferred)) return preferred;
  // then any other allowed
  for (const ch of allowed) {
    if (!tried.has(ch)) return ch;
  }
  return null;
}
