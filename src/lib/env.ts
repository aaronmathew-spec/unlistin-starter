export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`missing_env:${name}`);
  }
  return v.trim();
}

export function getEnv(name: string, fallback = ""): string {
  return (process.env[name] || fallback).trim();
}
