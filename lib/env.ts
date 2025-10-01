export function envBool(v: string | undefined): boolean {
  return v === "1" || v?.toLowerCase() === "true";
}

export function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}
