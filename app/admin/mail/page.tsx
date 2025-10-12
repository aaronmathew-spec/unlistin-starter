"use client";

import { useEffect, useState } from "react";

type Mail = {
  id: string;
  created_at: string;
  message_id: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  correlation_hint: string | null;
  routed_to_request_id: string | null;
};

type OtpsByMsg = Record<string, Array<{
  code: string;
  provider: string;
  source_message_id: string | null;
  created_at: string;
  meta?: { correlation_hint?: string | null };
}>>;

async function fetchList() {
  const res = await fetch("/api/admin/mail/list", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load admin mail list");
  return res.json() as Promise<{ mails: Mail[]; otpsByMsg: OtpsByMsg }>;
}

async function openRequest(mail_id: string) {
  const res = await fetch("/api/admin/mail/open-request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mail_id }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "open-request failed");
  return json as { ok: boolean; request_id: string; already_linked?: boolean };
}

export default function AdminMailPage() {
  const [data, setData] = useState<{ mails: Mail[]; otpsByMsg: OtpsByMsg } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const j = await fetchList();
      setData(j);
    } catch (e: any) {
      setErr(e?.message ?? "load failed");
    }
  }

  useEffect(() => { load(); }, []);

  async function handleOpen(mail: Mail) {
    setBusy(mail.id);
    setErr(null);
    try {
      const r = await openRequest(mail.id);
      await load();
      alert(`Request ready: ${r.request_id}`);
      // optional: navigate to verify page
      // window.location.href = `/requests/${r.request_id}/verify`;
    } catch (e: any) {
      setErr(e?.message ?? "open-request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Inbound Mail (latest 50)</h1>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={load}>
          Refresh
        </button>
      </div>

      {err && (
        <div className="mb-3 p-3 rounded border border-red-200 bg-red-50 text-red-700">{err}</div>
      )}

      <div className="grid gap-4">
        {(data?.mails ?? []).map((m) => {
          const otps = (data?.otpsByMsg?.[m.message_id || ""] ?? []) as any[];
          const linked = !!m.routed_to_request_id;
          return (
            <div key={m.id} className="rounded-lg border p-4">
              <div className="text-sm text-gray-500">{new Date(m.created_at).toLocaleString()}</div>
              <div className="mt-1 font-medium">{m.subject || <i>(no subject)</i>}</div>
              <div className="mt-1 text-sm text-gray-700">
                <b>From:</b> {m.from || "-"} &nbsp; <b>To:</b> {m.to || "-"}
              </div>
              <div className="mt-1 text-sm">
                <b>Hint:</b> {m.correlation_hint || "-"} &nbsp; <b>Routed UUID:</b>{" "}
                {m.routed_to_request_id || "-"}
              </div>

              <div className="mt-3 flex items-center gap-2">
                {!linked ? (
                  <button
                    className="px-3 py-2 rounded bg-emerald-600 text-white disabled:opacity-60"
                    disabled={!!busy}
                    onClick={() => handleOpen(m)}
                  >
                    {busy === m.id ? "Opening…" : "Open Request"}
                  </button>
                ) : (
                  <>
                    <a
                      className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
                      href={`/requests/${m.routed_to_request_id}/verify`}
                    >
                      Verify OTP
                    </a>
                    <a
                      className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300"
                      href={`/requests/${m.routed_to_request_id}`}
                    >
                      View Request
                    </a>
                  </>
                )}
              </div>

              {otps.length > 0 ? (
                <div className="mt-3 text-sm">
                  <div className="font-semibold mb-1">Matched OTPs</div>
                  <ul className="list-disc ml-5 space-y-1">
                    {otps.map((o, i) => (
                      <li key={i}>
                        <span className="font-mono">{o.code}</span> from <b>{o.provider}</b>{" "}
                        <span className="text-gray-500">
                          ({new Date(o.created_at).toLocaleString()})
                        </span>
                        {o?.meta?.correlation_hint ? (
                          <span className="text-gray-600"> — hint: {o.meta.correlation_hint}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500">No OTP extracted yet.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
