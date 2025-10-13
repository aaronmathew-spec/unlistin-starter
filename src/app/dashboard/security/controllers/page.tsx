import { listControllers } from "@/lib/controllers";

export default async function ControllersPage() {
  const controllers = await listControllers(500);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">Controller Coverage</h1>
      <p className="text-sm text-neutral-600 mb-4">Global catalog powering discovery → policy → dispatch.</p>

      <div className="grid gap-3">
        {controllers.map((c) => (
          <div key={c.id} className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{c.name}</div>
              <span className="text-xs px-2 py-1 rounded-full border">{c.status}</span>
            </div>
            <div className="text-sm text-neutral-700">{c.domain ?? "—"} {c.country ? `• ${c.country}` : ""}</div>
            <div className="text-xs text-neutral-600 mt-1">
              Channels: {(c.channel_types || []).join(", ") || "—"}
            </div>
            <div className="text-xs text-neutral-600">
              DSAR: {c.dsar_url ? <a className="underline" href={c.dsar_url} target="_blank">{c.dsar_url}</a> : "—"}
            </div>
            <div className="text-xs text-neutral-600">
              Privacy: {c.privacy_url ? <a className="underline" href={c.privacy_url} target="_blank">{c.privacy_url}</a> : "—"}
            </div>
          </div>
        ))}
        {controllers.length === 0 && <div className="text-sm text-neutral-600">No controllers yet.</div>}
      </div>

      <div className="mt-6">
        <form action="/api/admin/controllers/seed" method="post">
          <button className="px-3 py-2 rounded bg-black text-white">Seed Initial Controllers</button>
        </form>
      </div>
    </div>
  );
}
