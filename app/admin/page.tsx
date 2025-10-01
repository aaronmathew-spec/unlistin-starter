// app/admin/page.tsx
export const runtime = "nodejs";

async function getOverview(): Promise<{ ok: boolean; counts?: Record<string, number>; error?: string }> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/admin/overview`, {
      // In Vercel, relative fetch works for SSR too; absolute guard keeps local dev happy.
      cache: "no-store",
    });
    return await res.json();
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export default async function AdminHome() {
  const data = await getOverview();

  if (!data.ok) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {data.error === "Forbidden"
            ? "You need admin access. Ask an owner to grant you the 'admin' role in role_bindings."
            : data.error || "Unable to load admin overview."}
        </div>
      </div>
    );
  }

  const counts = data.counts || {};

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-sm text-gray-600">Read-only overview. RBAC enforced by role_bindings.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Object.keys(counts).length === 0 ? (
          <div className="rounded-xl border p-6 text-sm text-gray-600">No metrics yet.</div>
        ) : (
          Object.entries(counts).map(([k, v]) => (
            <div key={k} className="rounded-xl border p-6">
              <div className="text-sm text-gray-500">{k}</div>
              <div className="mt-1 text-2xl font-semibold">{v}</div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 text-sm text-gray-600">
        To enable write controls (flags/limits), we’ll add actions here; for now, this surface is read-only and safe.
      </div>
    </div>
  );
}
