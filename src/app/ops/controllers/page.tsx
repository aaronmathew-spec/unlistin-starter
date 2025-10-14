// src/app/ops/controllers/page.tsx
import Link from "next/link";

type SlaItem = {
  controllerId: string | null;
  name: string;
  domain: string | null;
  total: number;
  ok: number;
  needsReview: number;
  sending: number;
  failed: number;
  okRate: number;
};
type SlaResponse = { windowStart: string; controllers: SlaItem[] };

async function fetchData(): Promise<SlaResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/ops/controllers/sla`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return { windowStart: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), controllers: [] };
  }
  return (await res.json()) as SlaResponse;
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default async function ControllersSlaPage() {
  const data = await fetchData();
  const list = data.controllers;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Controller SLA</h1>
          <p className="text-sm text-gray-500">Window start: {new Date(data.windowStart).toLocaleString()}</p>
        </div>
        <Link
          href="/ops/overview"
          className="px-3 py-2 rounded-xl border hover:bg-gray-50 text-sm"
        >
          ← Back to Ops
        </Link>
      </header>

      <div className="overflow-auto rounded-2xl border">
        <table className="min-w-[800px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3">Controller</th>
              <th className="text-left px-4 py-3">Domain</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-right px-4 py-3">OK</th>
              <th className="text-right px-4 py-3">Needs Review</th>
              <th className="text-right px-4 py-3">Sending</th>
              <th className="text-right px-4 py-3">Failed</th>
              <th className="text-right px-4 py-3">OK Rate</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.controllerId ?? `unknown-${c.name}`} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.controllerId ?? "—"}</div>
                </td>
                <td className="px-4 py-3">{c.domain ?? "—"}</td>
                <td className="px-4 py-3 text-right">{c.total}</td>
                <td className="px-4 py-3 text-right">
                  <Badge tone="ok">{c.ok}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Badge tone="warn">{c.needsReview}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Badge tone="info">{c.sending}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Badge tone="bad">{c.failed}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Heat value={c.okRate} label={pct(c.okRate)} />
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  No activity in the last 30 days.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn" | "bad" | "info";
}) {
  const klass =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700"
      : tone === "info"
      ? "bg-sky-50 text-sky-700"
      : "bg-rose-50 text-rose-700";
  return <span className={`px-2 py-1 rounded-full text-xs ${klass}`}>{children}</span>;
}

function Heat({ value, label }: { value: number; label: string }) {
  // value: 0..1  → red → green
  const g = Math.round(value * 255);
  const r = 255 - g;
  const bg = `rgba(${r}, ${g}, 80, 0.12)`;
  const fg = `rgb(${r}, ${g}, 80)`;
  return (
    <span
      className="px-2 py-1 rounded-full text-xs"
      style={{ backgroundColor: bg, color: fg }}
      title={label}
    >
      {label}
    </span>
  );
}
