import Link from "next/link";

// Server component: fetches dashboard metrics and renders the chart client component
type TrendPoint = { date: string; prepared: number; completed: number };

async function getDashboard() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/dashboard`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      ok: boolean;
      stats?: {
        exposure?: number;
        prepared?: number;
        sent?: number;
        completed?: number;
      };
      trend?: TrendPoint[];
    };
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const payload = await getDashboard();

  const stats = payload?.stats ?? {};
  const exposure = stats.exposure ?? 0;
  const prepared = stats.prepared ?? 0;
  const sent = stats.sent ?? 0;
  const completed = stats.completed ?? 0;
  const trend = payload?.trend ?? [];

  // lazy import the client chart (Next will split it)
  const TrendClient = (await import("./trend-client")).default;

  const cards = [
    { kpi: "Exposure (approx.)", value: exposure },
    { kpi: "Prepared", value: prepared },
    { kpi: "Sent", value: sent },
    { kpi: "Completed", value: completed },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
          Settings
        </Link>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        A private overview of your current progress. Your personal identity is never shown here.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.kpi}
            className="rounded-2xl border bg-card p-4 shadow-sm transition"
          >
            <div className="text-sm text-muted-foreground">{c.kpi}</div>
            <div className="mt-2 text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-2 text-base font-medium">14-day Trend</div>
        <TrendClient data={trend} />
      </section>
    </div>
  );
}
