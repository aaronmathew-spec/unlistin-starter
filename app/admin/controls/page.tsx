/* eslint-disable @typescript-eslint/no-explicit-any */
import { isAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";

async function getControls() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/admin/adapter/controls`, {
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return {};
  const j = await res.json().catch(() => ({}));
  return j?.controls || {};
}

export default async function AdminControlsPage() {
  const ok = await isAdmin();
  if (!ok) return notFound();

  const controls = await getControls();
  const entries = Object.entries(controls as Record<string, any>);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Adapter Controls</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kill-switch, daily caps, and minimum confidence thresholds per adapter.
      </p>

      <div className="mt-6 space-y-4">
        <NewAdapterForm />
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left">Adapter</th>
                <th className="px-2 py-1 text-left">Killed</th>
                <th className="px-2 py-1 text-left">Daily Cap</th>
                <th className="px-2 py-1 text-left">Min Confidence</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-muted-foreground">
                    No overrides yet.
                  </td>
                </tr>
              )}
              {entries.map(([adapter, c]) => (
                <Row key={adapter} adapter={adapter} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NewAdapterForm() {
  async function action(formData: FormData) {
    "use server";
    const adapterId = String(formData.get("adapterId") || "").trim().toLowerCase();
    if (!adapterId) return;
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/admin/adapter/controls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adapterId, updates: { killed: false } }),
      cache: "no-store",
    }).catch(() => null);
  }

  return (
    <form action={action} className="flex gap-2">
      <input
        name="adapterId"
        placeholder="add adapter id (e.g. justdial)"
        className="w-64 rounded-md border bg-background px-3 py-1.5 text-sm"
      />
      <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">Add</button>
    </form>
  );
}

function Row({ adapter, c }: { adapter: string; c: any }) {
  async function save(formData: FormData) {
    "use server";
    const updates: any = {};
    updates.killed = formData.get("killed") === "on";
    const cap = Number(formData.get("daily_cap") || "");
    const minc = Number(formData.get("min_confidence") || "");
    if (Number.isFinite(cap)) updates.daily_cap = cap;
    if (Number.isFinite(minc)) updates.min_confidence = Math.max(0, Math.min(1, minc));
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/admin/adapter/controls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ adapterId: adapter, updates }),
      cache: "no-store",
    }).catch(() => null);
  }

  return (
    <tr className="border-t">
      <td className="px-2 py-2 font-mono text-xs">{adapter}</td>
      <td className="px-2 py-2">
        <form action={save} className="flex items-center gap-2">
          <input type="checkbox" name="killed" defaultChecked={!!c?.killed} />
      </form>
      </td>
      <td className="px-2 py-2">
        <form action={save}>
          <input
            name="daily_cap"
            defaultValue={c?.daily_cap ?? ""}
            className="w-28 rounded-md border bg-background px-2 py-1 text-xs"
            placeholder="e.g. 50"
          />
        </form>
      </td>
      <td className="px-2 py-2">
        <form action={save}>
          <input
            name="min_confidence"
            defaultValue={c?.min_confidence ?? ""}
            className="w-28 rounded-md border bg-background px-2 py-1 text-xs"
            placeholder="0.82"
          />
        </form>
      </td>
      <td className="px-2 py-2">
        <form action={save}>
          <button className="rounded-md border px-2 py-1 text-xs hover:bg-accent">Save</button>
        </form>
      </td>
    </tr>
  );
}
