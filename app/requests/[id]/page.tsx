import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import EditRequestForm from "./EditRequestForm";
import ActivityTab from "./ActivityTab";
import FilesTab from "./FilesTab";

export const runtime = "nodejs";

function supa() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (k) => jar.get(k)?.value } }
  );
}

async function getRequest(id: number) {
  const db = supa();
  const { data, error } = await db
    .from("requests")
    .select("id, title, description, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: number;
    title: string;
    description: string | null;
    status: "open" | "in_progress" | "closed" | string;
    created_at: string;
  } | null;
}

export default async function RequestPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    throw new Error("Invalid request id");
  }
  const reqRow = await getRequest(id);
  if (!reqRow) {
    return (
      <div className="p-6">
        <div className="rounded-md border bg-yellow-50 p-4 text-sm text-yellow-800">
          Request not found.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="text-xs text-neutral-500">Request</div>
        <h1 className="text-xl font-semibold">#{reqRow.id} — {reqRow.title}</h1>
        <div className="text-sm text-neutral-500">
          Created {new Date(reqRow.created_at).toLocaleString()} • Status: {reqRow.status}
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <nav className="flex flex-wrap gap-2 text-sm">
          <a href={`#edit`} className="rounded-md border px-3 py-1 hover:bg-neutral-50">Edit</a>
          <a href={`#files`} className="rounded-md border px-3 py-1 hover:bg-neutral-50">Files</a>
          <a href={`#activity`} className="rounded-md border px-3 py-1 hover:bg-neutral-50">Activity</a>
        </nav>

        <section id="edit" className="space-y-2">
          <h2 className="text-sm font-semibold">Edit</h2>
          <EditRequestForm initial={reqRow} />
        </section>

        <section id="files" className="space-y-2">
          <h2 className="text-sm font-semibold">Files</h2>
          <FilesTab requestId={reqRow.id} />
        </section>

        <section id="activity" className="space-y-2">
          <h2 className="text-sm font-semibold">Activity</h2>
          <ActivityTab requestId={reqRow.id} />
        </section>
      </div>
    </div>
  );
}
