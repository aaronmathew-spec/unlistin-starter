/* eslint-disable @next/next/no-img-element */
export const dynamic = "force-dynamic";

async function getData() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/mail/list`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load admin mail list");
  return res.json();
}

export default async function AdminMailPage() {
  const { mails, otpsByMsg } = await getData();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Inbound Mail (latest 50)</h1>

      <div className="grid gap-4">
        {(mails ?? []).map((m: any) => {
          const otps = (otpsByMsg?.[m.message_id] ?? []) as any[];
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

              {otps.length > 0 ? (
                <div className="mt-3 text-sm">
                  <div className="font-semibold mb-1">Matched OTPs</div>
                  <ul className="list-disc ml-5 space-y-1">
                    {otps.map((o, i) => (
                      <li key={i}>
                        <span className="font-mono">{o.code}</span> from <b>{o.provider}</b>{" "}
                        <span className="text-gray-500">({new Date(o.created_at).toLocaleString()})</span>
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
