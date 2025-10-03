// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import TrendClient from "./trend-client"; // default import

export const metadata = {
  title: "Dashboard",
};

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return notFound();

  const db = supa();

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [preparedRes, completedRes] = await Promise.all([
    db
      .from("actions")
      .select("created_at")
      .eq("status", "prepared")
      .gte("created_at", since),
    db
      .from("actions")
      .select("created_at")
      .eq("status", "completed")
      .gte("created_at", since),
  ]);

  // Graceful fallback if either query errors
  const preparedRows = preparedRes.error ? [] : (preparedRes.data ?? []);
  const completedRows = completedRes.error ? [] : (completedRes.data ?? []);

  function toSeries(rows: any[] | null | undefined) {
    const byDay = new Map<string, number>();
    (rows || []).forEach((r: any) => {
      const d = (r.created_at || "").slice(0, 10); // YYYY-MM-DD
      if (d) byDay.set(d, (byDay.get(d) || 0) + 1);
    });
    return byDay;
  }

  const preparedByDay = toSeries(preparedRows);
  const completedByDay = toSeries(completedRows);

  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    days.push(d.toISOString().slice(0, 10));
  }

  const trend = days.map((d) => ({
    date: d,
    prepared: preparedByDay.get(d) || 0,
    completed: completedByDay.get(d) || 0,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your recent activity at a glance.
      </p>

      <div className="mt-6 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-2 text-base font-medium">14-Day Trend</div>
        <TrendClient data={trend} />
      </div>
    </div>
  );
}
