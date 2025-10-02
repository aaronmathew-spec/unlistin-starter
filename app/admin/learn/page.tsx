import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/auth";
import { suggestMinConfidenceBump } from "@/lib/auto/learn";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

type Row = {
  adapter_id: string;
  state: string | null;
  cnt_prepared: number;
  cnt_sent: number;
  cnt_removed: number;
  cnt_failed: number;
  sum_ms: number;
};

export default async function AdminLearnPage() {
  const ok = await isAdmin();
  if (!ok) return notFound();

  const db = supa();
  const { data } = await db
    .from("adapter_stats")
    .select("adapter_id, state, cnt_prepared, cnt_sent, cnt_removed, cnt_failed, sum_ms")
    .order("adapter_id", { ascending: true });

  const rows = (data || []) as Row[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Learning (Admin)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Non-PII adapter performance. Suggestions are conservative and bounded. Customers never see this.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Adapter</th>
              <th className="px-3 py-2 text-left">State</th>
              <th className="px-3 py-2 text-right">Prepared</th>
              <th className="px-3 py-2 text-right">Sent</th>
              <th className="px-3 py-2 text-right">Removed</th>
              <th className="px-3 py-2 text-right">Failed</th>
              <th className="px-3 py-2 text-right">Win Rate</th>
              <th className="px-3 py-2 text-right">Suggest Δ conf</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const sent = Math.max(1, r.cnt_sent);
              const win = r.cnt_removed / sent;
              const bump = suggestMinConfidenceBump(win);
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{r.adapter_id}</td>
                  <td className="px-3 py-2">{r.state || "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.cnt_prepared}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.cnt_sent}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.cnt_removed}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.cnt_failed}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {(win * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {bump > 0 ? `+${bump.toFixed(2)}` : bump.toFixed(2)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No data yet. As actions resolve, learning metrics will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Suggestions are informational. Threshold updates remain manual to keep behavior predictable.
      </p>
    </div>
  );
}
