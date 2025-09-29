export const runtime = "nodejs";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import FilesTab from "./FilesTab";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

type RequestRow = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
};

async function getRequest(id: number) {
  const db = supa();
  const { data, error } = await db.from("requests").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data as RequestRow;
}

export default async function RequestPage(props: { params: { id: string } }) {
  const id = Number(props.params.id);
  if (!Number.isFinite(id)) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
          Invalid request id.
        </div>
      </div>
    );
  }

  let reqRow: RequestRow | null = null;
  let err: string | null = null;
  try {
    reqRow = await getRequest(id);
  } catch (e: any) {
    err = e?.message ?? "Failed to load request";
  }

  if (err || !reqRow) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
          {err || "Not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{reqRow.title}</h1>
        <div className="text-sm text-neutral-600">
          Status: <span className="font-medium">{reqRow.status}</span> • Created{" "}
          {new Date(reqRow.created_at).toLocaleString()}
        </div>
        {reqRow.description && (
          <p className="mt-2 whitespace-pre-wrap text-neutral-800">{reqRow.description}</p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Files</h2>
        {/* Client tab with Download/Delete actions */}
        <FilesTab requestId={reqRow.id} />
      </section>
    </div>
  );
}
