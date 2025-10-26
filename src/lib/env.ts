// src/lib/env.ts

/** Internal: robust boolean parser for env-style strings */
function parseBool(v?: string | null): boolean {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * envBool overloads:
 * 1) envBool("MY_FLAG", true)  -> reads process.env.MY_FLAG (fallback=true)
 * 2) envBool("true")           -> parses the provided value directly
 */
export function envBool(nameOrValue: string | undefined, fallback?: boolean): boolean;
export function envBool(nameOrValue: string | undefined, fallback?: boolean): boolean {
  // If a fallback is provided, treat first arg as an env var name
  if (typeof fallback !== "undefined") {
    const raw = nameOrValue ? process.env[nameOrValue] : undefined;
    return raw == null ? !!fallback : parseBool(raw);
  }
  // Otherwise treat it as a literal value to parse
  return parseBool(nameOrValue);
}

/** Get a required environment variable or throw (useful for secrets/URLs) */
export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

/** Optional helpers: safe string/int reads with fallbacks */
export function envStr(name: string, fallback: string | null = null): string | null {
  const v = process.env[name];
  if (v == null || String(v).trim() === "") return fallback;
  return String(v);
}

export function envInt(name: string, fallback: number | null = null): number | null {
  const v = process.env[name];
  if (v == null) return fallback;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}
