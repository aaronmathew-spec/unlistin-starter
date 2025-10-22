// inside src/lib/proofs/pack.ts
import { supabaseAdmin } from "@/src/lib/supabase/admin";

const BUCKET = "proof-vault"; // change if you use a different bucket

type StorageFile = { name: string; id?: string; updated_at?: string; created_at?: string; };

function inferTypeFromFilename(name: string): Artifact["type"] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.includes("screenshot")) return "screenshot";
  if (lower.endsWith(".html") || lower.includes("dom") || lower.includes("page")) return "dom_tree";
  if (lower.includes("receipt") || lower.includes("email")) return "email_receipt";
  if (lower.endsWith(".json") || lower.endsWith(".txt")) return "api_response";
  return "search_index"; // fallback
}

async function listArtifactsFromStorage(subjectId: string): Promise<StorageFile[]> {
  const prefix = `subjects/${subjectId}`;
  const s = supabaseAdmin();
  const out: StorageFile[] = [];

  // paginate lists to be safe
  let page = 0;
  while (true) {
    const { data, error } = await s
      .storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset: page * 100, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`storage.list error: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      // Skip "subdirectories" entries; we want files
      if (item.name && !item.name.endsWith("/")) {
        out.push({ name: `${prefix}/${item.name}`, updated_at: item.updated_at, created_at: item.created_at });
      }
    }
    if (data.length < 100) break;
    page++;
  }
  return out;
}

async function getArtifactsForSubject(subjectId: string): Promise<Artifact[]> {
  const files = await listArtifactsFromStorage(subjectId);
  const artifacts: Artifact[] = files.map((f) => ({
    id: f.name,
    type: inferTypeFromFilename(f.name),
    createdAt: f.created_at || new Date().toISOString(),
    contentUri: f.name, // we’ll fetch via createSignedUrl below
    meta: { updatedAt: f.updated_at },
  }));
  return artifacts;
}

async function streamArtifact(contentUri: string): Promise<Uint8Array> {
  // contentUri is actually the storage path: subjects/<id>/<file>
  const s = supabaseAdmin();
  const { data, error } = await s.storage.from(BUCKET).createSignedUrl(contentUri, 60); // 60s URL
  if (error || !data?.signedUrl) throw new Error(`signedUrl error: ${error?.message || "no url"}`);

  const res = await fetch(data.signedUrl);
  if (!res.ok) throw new Error(`Fetch failed for ${contentUri}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
