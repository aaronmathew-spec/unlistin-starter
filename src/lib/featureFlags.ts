// src/lib/featureFlags.ts
type Flags = Record<string, boolean>;

const raw = process.env.NEXT_PUBLIC_FEATURE_FLAGS ?? "{}";
let parsed: Flags = {};
try {
  parsed = JSON.parse(raw);
} catch {
  parsed = {};
}

export function flag(name: string, fallback = false): boolean {
  return Object.prototype.hasOwnProperty.call(parsed, name) ? !!parsed[name] : fallback;
}
