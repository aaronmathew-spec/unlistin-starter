import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isAdmin } from "@/lib/auth";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

type Ctrl = {
  adapter_id: string;
  killed: boolean;
  daily_cap: number | null;
  min_confidence: number | null;
  updated_at?: string | null;
};

async function listControls(): Promise<Ctrl[]> {
  const db = supa();
  const { data } = await db.from("adapter_controls").select("*").order("adapter_id");
  return (data || []) as Ctrl[];
}

export default async function AdminAdaptersPage() {
  const ok = await isAdmin();
  if (!ok) return notFound();

  const rows = await listControls();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Adapters (Admin)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kill-switches and safe caps. Customers never see this; no PII stored.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Adapter</th>
              <th className="px-3 py-2 text-center">Killed</th>
              <th className="px-3 py-2 text-right">Daily Cap</th>
              <th className="px-3 py-2 text-right">Min Confidence</th>
              <th className="px-3 py-2 text-right">Updated</th>
              <th className="px-3 py-2 text-right">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => <Row key={r.adapter_id} row={r} />)}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  No overrides yet. Use API to create or let learning suggest nudges.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(x?: string | null) {
  if (!x) return "—";
  try {
    return new Date(x).toLocaleString();
  } catch {
    return x;
  }
}

async function saveRow(patch: Partial<Ctrl>) {
  await fetch("/api/admin/adapter/controls", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
}

function Row({ row }: { row: Ctrl }) {
  // server components can't use state; use simple form POST via fetch()
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium">{row.adapter_id}</td>
      <td className="px-3 py-2 text-center">
        <form action={async (formData) => {
          "use server";
          await saveRow({ adapter_id: row.adapter_id, killed: formData.get("killed") === "on" });
        }}>
          <input type="checkbox" name="killed" defaultChecked={row.killed} />
        </form>
      </td>
      <td className="px-3 py-2 text-right">
        <form action={async (formData) => {
          "use server";
          const n = Number(formData.get("cap") || 0);
          await saveRow({ adapter_id: row.adapter_id, daily_cap: Number.isFinite(n) ? n : 0 });
        }}>
          <input
            name="cap"
            type="number"
            defaultValue={row.daily_cap ?? 0}
            min={0}
            max={1000}
            className="w-24 rounded border bg-background px-2 py-1 text-right"
          />
        </form>
      </td>
      <td className="px-3 py-2 text-right">
        <form action={async (formData) => {
          "use server";
          const n = Number(formData.get("minc") || 0.82);
          await saveRow({ adapter_id: row.adapter_id, min_confidence: Number.isFinite(n) ? n : 0.82 });
        }}>
          <input
            name="minc"
            type="number"
            step="0.01"
            min={0.5}
            max={0.99}
            defaultValue={row.min_confidence ?? 0.82}
            className="w-24 rounded border bg-background px-2 py-1 text-right"
          />
        </form>
      </td>
      <td className="px-3 py-2 text-right text-muted-foreground">{fmt(row.updated_at)}</td>
      <td className="px-3 py-2 text-right">
        <form action={async () => {
          "use server";
          await saveRow({
            adapter_id: row.adapter_id,
            killed: row.killed,
            daily_cap: row.daily_cap ?? 0,
            min_confidence: row.min_confidence ?? 0.82,
          });
        }}>
          <button className="rounded-lg border px-3 py-1 text-xs">Save</button>
        </form>
      </td>
    </tr>
  );
}
