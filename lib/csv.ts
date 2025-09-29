// lib/csv.ts
type Col<T> = [header: string, getter: (row: T) => unknown];

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Quote if contains comma, quote, or newline
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T>(rows: T[], cols: Col<T>[]): string {
  const header = cols.map(([h]) => escapeCell(h)).join(",");
  const lines = rows.map((r) =>
    cols.map(([, getter]) => escapeCell(getter(r))).join(",")
  );
  return [header, ...lines].join("\n") + "\n";
}
