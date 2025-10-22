// src/lib/util/strings.ts
export function isNonEmpty(v?: string | null): v is string {
  return !!(v && v.trim().length > 0);
}
