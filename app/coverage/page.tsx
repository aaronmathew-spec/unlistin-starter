"use client";

import { useEffect, useMemo, useState } from "react";

type Broker = { id: number; name: string; url?: string | null; created_at?: string };
type Cov = {
  id: number;
  broker_id: number;
  surface: string;
  status: "open" | "in_progress" | "resolved";
  weight: number;
  note?: string | null;
  created_at?: string;
};
type FileRow = {
  id: number;
  coverage_id: number;
  path: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
};

const STATUSES: Cov["status"][] = ["open", "in_progress", "resolved"];

export default function CoveragePage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [cov, setCov] = useState<Cov[]>([]);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<number>(0);

  // filters + paging
  const [filterBroker, setFilterBroker] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | Cov["status"]>("");
  const [search, setSearch] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // form state
  const [bName, setBName] = useState("");
  const [bUrl, setBUrl] = useState("");
  const [selBroker, setSelBroker] = useState<number | "">("");
  const [surface, setSurface] = useState("");
  const [status, setStatus] = useState<Cov["status"]>("open");
  const [weight, setWeight] = useState<number>(1);
  const [note, setNote] = useState("");

  // evidence drawer state per coverage id
  const [openEvidence, setOpenEvidence] = useState<Record<number, boolean>>({});
  const [filesByCov, setFilesByCov] = useState<Record<number, { items: FileRow[]; next: string | null }>>({});

  const filtered = useMemo(() => {
    let items = [...cov];
    if (filterBroker) items = items.filter((c) => c.broker_id === Number(filterBroker));
    if (filterStatus) items = items.filter((c) => c.status === filterStatus);
    const q = search.trim().toLowerCase();
    if (q) items = items.filter((c) => c.surface.toLowerCase().includes(q) || (c.note ?? "").toLowerCase().includes(q));
    return items;
  }, [cov, filterBroker, filterStatus, search]);

  const grouped = useMemo(() => {
    const map = new Map<number, { broker: Broker; items: Cov[] }>();
    for (const b of brokers) map.set(b.id, { broker: b, items: [] });
    for (const c of filtered) {
      const g = map.get(c.broker_id) ?? null;
      if (g) g.items.push(c);
    }
    // keep only brokers with rows (when filters applied)
    return Array.from(map.values()).filter((g) => g.items.length > 0);
  }, [brokers, filtered]);

  async function fetchCoverage(cursor?: string | null) {
    const u = new URL("/api/coverage", window.location.origin);
    u.searchParams.set("limit", "50");
    if (filterBroker) u.searchParams.set("broker_id", String(filterBroker));
    if (cursor) u.searchParams.set("cursor", cursor);
    const res = await fetch(u.toString(), { cache: "no-store" });
    const j = await res.json();
    return { items: (j.coverage ?? []) as Cov[], next: j.nextCursor ?? null };
  }

  const refreshAll = async () => {
    setLoading(true);
    const [b, first, s] = await Promise.all([
      fetch("/api/brokers").then((r) => r.json()),
      fetchCoverage(null),
      fetch("/api/exposure").then((r) => r.json()),
    ]);
    setBrokers(b.brokers ?? []);
    setCov(first.items);
    setNextCursor(first.next);
    setScore(typeof s.score === "number" ? s.score : 0);
    setLoading(false);
  };

  useEffect(() => { refreshAll(); /* eslint-disable-next-line */ }, [filterBroker]);

  const loadMore = async () => {
    if (!nextCursor) return;
    const { items, next } = await fetchCoverage(nextCursor);
    setCov((prev) => [...prev, ...items]);
    setNextCursor(next);
  };

  const onAddBroker = async () => {
    if (!bName.trim()) return;
    const res = await fetch("/api/brokers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bName.trim(), url: bUrl.trim() || undefined }),
    });
    if (res.ok) {
      setBName(""); setBUrl("");
      await refreshAll();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Failed to add broker");
    }
  };

  const onAddCoverage = async () => {
    if (!selBroker || !surface.trim()) return;
    const res = await fetch("/api/coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        broker_id: Number(selBroker),
        surface: surface.trim(),
        status,
        weight,
        note: note.trim() || undefined,
      }),
    });
    if (res.ok) {
      setSurface(""); setNote(""); setWeight(1);
      await refreshAll();
    } else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error?.message || j?.error || "Failed to add coverage");
    }
  };

  const onQuickStatus = async (id: number, newStatus: Cov["status"]) => {
    const res = await fetch("/api/coverage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    if (res.ok) await refreshAll();
  };

  const toggleEvidence = async (covId: number) => {
    setOpenEvidence((m) => ({ ...m, [covId]: !m[covId] }));
    if (!filesByCov[covId]) {
      await fetchFiles(covId);
    }
  };

  async function fetchFiles(covId: number, cursor?: string | null) {
    const u = new URL(`/api/coverage/${covId}/files`, window.location.origin);
    u.searchParams.set("limit", "20");
    if (cursor) u.searchParams.set("cursor", cursor);
    const j = await fetch(u).then((r) => r.json());
    setFilesByCov((prev) => ({
      ...prev,
      [covId]: {
        items: cursor ? [...(prev[covId]?.items ?? []), ...(j.files ?? [])] : (j.files ?? []),
        next: j.nextCursor ?? null,
      },
    }));
  }

  async function uploadFile(covId: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/coverage/${covId}/files`, { method: "POST", body: fd });
    if (res.ok) await fetchFiles(covId);
    else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Upload failed");
    }
  }

  async function deleteFile(covId: number, fileId: number) {
    const res = await fetch(`/api/coverage/${covId}/files?fileId=${fileId}`, { method: "DELETE" });
    if (res.ok) await fetchFiles(covId);
    else {
      const j = await res.json().catch(() => ({}));
      alert(j?.error || "Delete failed");
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Coverage Map</h1>
        <ScorePill score={score} />
      </header>

      {/* Filters */}
      <section className="border rounded-xl p-4 flex flex-wrap gap-3 items-center">
        <select
          value={filterBroker}
          onChange={(e) => setFilterBroker((e.target.value as any) || "")}
          className="border rounded-lg px-3 py-2 min-w-[220px]"
        >
          <option value="">All brokers</option>
          {brokers.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus((e.target.value as any) || "")}
          className="border rounded-lg px-3 py-2"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option value={s} key={s}>{label(s)}</option>)}
        </select>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search surface/note…"
          className="border rounded-lg px-3 py-2 min-w-[260px] flex-1"
        />

        { (filterBroker || filterStatus || search) && (
          <button
            onClick={() => { setFilterBroker(""); setFilterStatus(""); setSearch(""); }}
            className="px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            Reset
          </button>
        )}
      </section>

      {/* Add broker */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Add Broker</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={bName}
            onChange={(e) => setBName(e.target.value)}
            placeholder="Broker name (e.g., Twitter)"
            className="border rounded-lg px-3 py-2 min-w-[240px]"
          />
          <input
            value={bUrl}
            onChange={(e) => setBUrl(e.target.value)}
            placeholder="URL (optional)"
            className="border rounded-lg px-3 py-2 min-w-[320px]"
          />
          <button onClick={onAddBroker} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Add
          </button>
        </div>
      </section>

      {/* Add coverage */}
      <section className="border rounded-xl p-4 space-y-3">
        <h2 className="font-medium">Add Coverage Item</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={selBroker}
            onChange={(e) => setSelBroker((e.target.value as any) || "")}
            className="border rounded-lg px-3 py-2 min-w-[240px]"
          >
            <option value="">Choose broker…</option>
            {brokers.map((b) => (
              <option value={b.id} key={b.id}>{b.name}</option>
            ))}
          </select>
          <input
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            placeholder="Surface (e.g., Profile)"
            className="border rounded-lg px-3 py-2 min-w-[240px]"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Cov["status"])}
            className="border rounded-lg px-3 py-2"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="border rounded-lg px-3 py-2 w-28"
            title="Weight"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="border rounded-lg px-3 py-2 min-w-[320px]"
          />
          <button onClick={onAddCoverage} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
            Add
          </button>
        </div>
      </section>

      {/* Listing */}
      <section className="space-y-4">
        <h2 className="font-medium">By Broker</h2>
        {loading ? (
          <div>Loading…</div>
        ) : grouped.length === 0 ? (
          <div className="text-gray-600">No coverage yet.</div>
        ) : (
          grouped.map(({ broker, items }) => (
            <div key={broker.id} className="border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <div className="font-medium">
                  {broker.name}{" "}
                  {broker.url ? (
                    <a className="text-blue-600 underline ml-2" href={broker.url} target="_blank">link</a>
                  ) : null}
                </div>
                <div className="text-sm text-gray-500">{items.length} item(s)</div>
              </div>

              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2">Surface</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Weight</th>
                    <th className="text-left px-4 py-2">Note</th>
                    <th className="text-right px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-t align-top">
                      <td className="px-4 py-2">{c.surface}</td>
                      <td className="px-4 py-2">{label(c.status)}</td>
                      <td className="px-4 py-2">{c.weight}</td>
                      <td className="px-4 py-2">{c.note ?? "—"}</td>
                      <td className="px-4 py-2 text-right space-x-2">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() => onQuickStatus(c.id, s)}
                            className="px-2 py-1 rounded border hover:bg-gray-50"
                          >
                            {label(s)}
                          </button>
                        ))}
                        <button
                          onClick={() => toggleEvidence(c.id)}
                          className="px-2 py-1 rounded border hover:bg-gray-50"
                        >
                          Evidence
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Evidence drawers */}
              {items.map((c) =>
                openEvidence[c.id] ? (
                  <EvidenceRow
                    key={`ev-${c.id}`}
                    covId={c.id}
                    state={filesByCov[c.id]}
                    onLoadMore={() => fetchFiles(c.id, filesByCov[c.id]?.next || null)}
                    onUpload={(f) => uploadFile(c.id, f)}
                    onDelete={(fileId) => deleteFile(c.id, fileId)}
                  />
                ) : null
              )}
            </div>
          ))
        )}

        {nextCursor && (
          <div className="flex justify-center mt-4">
            <button onClick={loadMore} className="px-4 py-2 rounded-lg border hover:bg-gray-50">
              Load more
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function EvidenceRow({
  covId,
  state,
  onLoadMore,
  onUpload,
  onDelete,
}: {
  covId: number;
  state?: { items: FileRow[]; next: string | null };
  onLoadMore: () => void;
  onUpload: (f: File) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="border-t px-4 py-3 bg-white">
      <div className="flex items-center gap-3">
        <strong>Evidence</strong>
        <input
          type="file"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          className="text-sm"
        />
      </div>
      <div className="mt-2 text-sm">
        {(state?.items ?? []).length === 0 ? (
          <div className="text-gray-500">No files yet.</div>
        ) : (
          <ul className="space-y-1">
            {state!.items.map((f) => (
              <li key={f.id} className="flex items-center justify-between border rounded p-2">
                <div className="truncate">
                  <span className="font-medium">{f.name}</span>
                  <span className="ml-2 text-gray-500">
                    {f.mime || "file"} · {(f.size_bytes ?? 0).toLocaleString()} bytes
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/coverage/${covId}/files/${f.id}/download`}
                    className="px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => onDelete(f.id)}
                    className="px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {state?.next && (
          <div className="mt-2">
            <button onClick={onLoadMore} className="px-3 py-1 rounded border hover:bg-gray-50">
              Load more files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function label(s: Cov["status"]) {
  switch (s) {
    case "open": return "Open";
    case "in_progress": return "In Progress";
    case "resolved": return "Resolved";
  }
}

function ScorePill({ score }: { score: number }) {
  const rounded = Math.round(score);
  const color =
    rounded >= 75 ? "bg-red-100 text-red-700" :
    rounded >= 40 ? "bg-amber-100 text-amber-700" :
                    "bg-emerald-100 text-emerald-700";
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${color}`}>
      Exposure: {rounded}
    </span>
  );
}
