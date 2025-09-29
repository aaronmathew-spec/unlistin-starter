"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FEATURE_AI_UI } from "@/lib/flags";

type RequestRow = {
  id: number;
  title: string | null;
  description: string | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  created_at: string | null;
  updated_at: string | null;
};

type FileRow = {
  id: number;
  request_id: number;
  path: string;
  name: string;
  mime: string;
  size_bytes: number | null;
  created_at: string | null;
};

type CommentRow = {
  id: number;
  request_id: number;
  user_id: string;
  body: string;
  created_at: string;
};

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const rid = Number(params.id);

  const [activeTab, setActiveTab] = useState<"about" | "files" | "comments">("about");

  const [reqRow, setReqRow] = useState<RequestRow | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // per-file action state
  const [busyFile, setBusyFile] = useState<Record<number, boolean>>({});

  // comments state
  const [addingComment, setAddingComment] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [busyComment, setBusyComment] = useState<Record<number, boolean>>({});

  // AI Assist state (flagged)
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);

  const sizeFmt = (n?: number | null) =>
    !n && n !== 0
      ? "—"
      : n < 1024
      ? `${n} B`
      : n < 1024 * 1024
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / (1024 * 1024)).toFixed(1)} MB`;

  async function fetchRequest() {
    const j = await fetch(`/api/requests/${rid}`, { cache: "no-store" }).then((r) => r.json());
    setReqRow(j.request ?? null);
  }
  async function fetchFiles() {
    const j = await fetch(`/api/requests/${rid}/files`, { cache: "no-store" }).then((r) => r.json());
    setFiles((j.files ?? []) as FileRow[]);
  }
  async function fetchComments(cursor?: string | null) {
    const url = new URL(`/api/requests/${rid}/comments`, window.location.origin);
    url.searchParams.set("limit", "30");
    if (cursor) url.searchParams.set("cursor", cursor);
    const j = await fetch(url.toString(), { cache: "no-store" }).then((r) => r.json());
    const rows = (j.comments ?? []) as CommentRow[];
    if (cursor) {
      setComments((prev) => [...prev, ...rows]);
    } else {
      setComments(rows);
    }
    setCommentsCursor(j.nextCursor ?? null);
  }

  async function refreshAll() {
    setLoading(true);
    await Promise.all([fetchRequest(), fetchFiles(), fetchComments(null)]);
    setLoading(false);
  }

  useEffect(() => {
    if (!Number.isFinite(rid)) return;
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  // Realtime subscriptions
  useEffect(() => {
    if (!Number.isFinite(rid)) return;
    const supabase = createSupabaseBrowserClient();

    const chComments = supabase
      .channel(`rc:${rid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "request_comments", filter: `request_id=eq.${rid}` },
        (payload) => {
          const row = payload.new as any;
          setComments((prev) => [{ ...(row as CommentRow) }, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "request_comments", filter: `request_id=eq.${rid}` },
        (payload) => {
          const oldRow = payload.old as any;
          setComments((prev) => prev.filter((c) => c.id !== Number(oldRow.id)));
        }
      )
      .subscribe();

    const chFiles = supabase
      .channel(`rf:${rid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "request_files", filter: `request_id=eq.${rid}` },
        async () => { await fetchFiles(); }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "request_files", filter: `request_id=eq.${rid}` },
        async () => { await fetchFiles(); }
      )
      .subscribe();

    const chReq = supabase
      .channel(`rq:${rid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "requests", filter: `id=eq.${rid}` },
        (payload) => {
          const row = payload.new as any;
          setReqRow((prev) => (prev ? { ...prev, status: row.status, updated_at: row.updated_at } : prev));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chComments);
      supabase.removeChannel(chFiles);
      supabase.removeChannel(chReq);
      supabase.removeAllChannels();
    };
  }, [rid]);

  const title = useMemo(
    () => (reqRow?.title ? `Request #${rid} – ${reqRow.title}` : `Request #${rid}`),
    [rid, reqRow?.title]
  );

  // Upload handler
  async function onUpload(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      toast("Please choose a file");
      return;
    }

    const fd = new FormData();
    fd.append("file", file, file.name);

    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/requests/${rid}/files`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Upload failed (${res.status})`);
      }
      toast("File uploaded");
      if (input) input.value = "";
      await fetchFiles();
      setActiveTab("files");
    } catch (e: any) {
      setUploadError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function signAndOpen(fid: number) {
    setBusyFile((m) => ({ ...m, [fid]: true }));
    try {
      const j = await fetch(`/api/requests/${rid}/files/${fid}/sign`).then((r) => r.json());
      const url = j?.signedUrl as string | undefined;
      if (!url) throw new Error(j?.error || "Could not sign URL");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast(e?.message || "Download failed");
    } finally {
      setBusyFile((m) => {
        const n = { ...m };
        delete n[fid];
        return n;
      });
    }
  }
  async function signAndCopy(fid: number) {
    setBusyFile((m) => ({ ...m, [fid]: true }));
    try {
      const j = await fetch(`/api/requests/${rid}/files/${fid}/sign`).then((r) => r.json());
      const url = j?.signedUrl as string | undefined;
      if (!url) throw new Error(j?.error || "Could not sign URL");
      await navigator.clipboard.writeText(url);
      toast("Link copied");
    } catch (e: any) {
      toast(e?.message || "Copy failed");
    } finally {
      setBusyFile((m) => {
        const n = { ...m };
        delete n[fid];
        return n;
      });
    }
  }
  async function removeFile(fid: number) {
    if (!confirm("Delete this file?")) return;
    setBusyFile((m) => ({ ...m, [fid]: true }));
    try {
      const res = await fetch(`/api/requests/${rid}/files/${fid}/delete`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Delete failed (${res.status})`);
      }
      setFiles((prev) => prev.filter((f) => f.id !== fid));
      toast("File deleted");
    } catch (e: any) {
      toast(e?.message || "Delete failed");
    } finally {
      setBusyFile((m) => {
        const n = { ...m };
        delete n[fid];
        return n;
      });
    }
  }

  // Comment actions
  async function addComment() {
    if (!newBody.trim()) {
      toast("Write something first");
      return;
    }
    setAddingComment(true);
    try {
      const res = await fetch(`/api/requests/${rid}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newBody.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Create failed (${res.status})`);
      }
      setNewBody("");
      setActiveTab("comments");
    } catch (e: any) {
      toast(e?.message || "Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  }

  async function deleteComment(id: number) {
    if (!confirm("Delete this comment?")) return;
    setBusyComment((m) => ({ ...m, [id]: true }));
    try {
      const res = await fetch(`/api/requests/${rid}/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Delete failed (${res.status})`);
      }
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (e: any) {
      toast(e?.message || "Failed to delete");
    } finally {
      setBusyComment((m) => {
        const n = { ...m };
        delete n[id];
        return n;
      });
    }
  }

  // AI Assist action (flagged)
  async function runAiAssist() {
    if (!aiPrompt.trim()) { toast("Enter a prompt"); return; }
    setAiBusy(true);
    setAiOutput(null);
    try {
      const res = await fetch(`/api/agents/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: rid, prompt: aiPrompt.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Agent error (${res.status})`);
      const text = j?.action?.text || j?.task?.payload?.text || "(no output)";
      setAiOutput(String(text));
      toast("Draft generated");
    } catch (e: any) {
      toast(e?.message || "Agent failed");
    } finally {
      setAiBusy(false);
    }
  }

  if (!Number.isFinite(rid)) {
    return (
      <div className="p-6">
        <div className="text-red-600">Invalid request id</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">
          {reqRow?.title ? `Request #${rid} – ${reqRow.title}` : `Request #${rid}`}
        </h1>
        <Link href="/requests" className="px-3 py-1 rounded border hover:bg-gray-50">
          Back to Requests
        </Link>
      </header>

      {/* AI Assist (flagged) */}
      {FEATURE_AI_UI && (
        <section className="border rounded-xl p-4 space-y-3 bg-gray-50/40">
          <div className="font-medium">AI Assist</div>
          <div className="text-xs text-gray-600">
            Generates a concise draft or summary for this request. Safe by design (HITL).
          </div>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., Summarize this request and propose a 3-step next action plan."
            className="border rounded-lg px-3 py-2 w-full min-h-[80px] bg-white"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={runAiAssist}
              disabled={aiBusy}
              className="px-3 py-1 rounded border hover:bg-gray-50 text-sm"
            >
              {aiBusy ? "Thinking…" : "Generate Draft"}
            </button>
            {aiOutput && (
              <button
                className="px-3 py-1 rounded border hover:bg-gray-50 text-sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(aiOutput!);
                  toast("Copied");
                }}
              >
                Copy Output
              </button>
            )}
          </div>
          {aiOutput && (
            <pre className="whitespace-pre-wrap text-sm border rounded-lg bg-white p-3">{aiOutput}</pre>
          )}
        </section>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : !reqRow ? (
        <div className="text-gray-600">Not found.</div>
      ) : (
        <>
          {/* Tabs */}
          <nav className="flex gap-2 border-b pb-2">
            {(["about", "files", "comments"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-1 rounded-t ${activeTab === t ? "bg-gray-100 border border-b-0" : "border-transparent"}`}
              >
                {t === "about" ? "About" : t === "files" ? "Files" : "Comments"}
              </button>
            ))}
          </nav>

          {/* About Tab */}
          {activeTab === "about" && (
            <section className="border rounded-b-xl p-4 space-y-2">
              <div className="font-medium">About</div>
              <div className="text-sm">
                <div><span className="text-gray-600">Status:</span> {reqRow.status.replace("_", " ")}</div>
                <div><span className="text-gray-600">Updated:</span> {reqRow.updated_at ? new Date(reqRow.updated_at).toLocaleString() : "—"}</div>
              </div>
              {reqRow.description && (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{reqRow.description}</p>
              )}
            </section>
          )}

          {/* Files Tab */}
          {activeTab === "files" && (
            <section className="border rounded-b-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Files</h2>
                <form onSubmit={onUpload} className="flex items-center gap-2">
                  <input name="file" type="file" className="text-sm" disabled={uploading} />
                  <button type="submit" disabled={uploading} className="px-3 py-1 rounded border hover:bg-gray-50 text-sm">
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                </form>
              </div>
              {uploadError && <div className="text-sm text-red-600">{uploadError}</div>}
              {files.length === 0 ? (
                <div className="text-gray-600 text-sm">No files yet.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2">Name</th>
                      <th className="text-left px-4 py-2">Type</th>
                      <th className="text-left px-4 py-2">Size</th>
                      <th className="text-left px-4 py-2">Uploaded</th>
                      <th className="text-right px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => {
                      const isBusy = !!busyFile[f.id];
                      return (
                        <tr key={f.id} className="border-t">
                          <td className="px-4 py-2">{f.name}</td>
                          <td className="px-4 py-2">{f.mime || "—"}</td>
                          <td className="px-4 py-2">{sizeFmt(f.size_bytes)}</td>
                          <td className="px-4 py-2">{f.created_at ? new Date(f.created_at).toLocaleString() : "—"}</td>
                          <td className="px-4 py-2 text-right space-x-2">
                            <button disabled={isBusy} onClick={() => signAndOpen(f.id)} className="px-2 py-1 rounded border hover:bg-gray-50">
                              {isBusy ? "…" : "Download"}
                            </button>
                            <button disabled={isBusy} onClick={() => signAndCopy(f.id)} className="px-2 py-1 rounded border hover:bg-gray-50">
                              {isBusy ? "…" : "Copy link"}
                            </button>
                            <button disabled={isBusy} onClick={() => removeFile(f.id)} className="px-2 py-1 rounded border hover:bg-gray-50">
                              {isBusy ? "…" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* Comments Tab */}
          {activeTab === "comments" && (
            <section className="border rounded-b-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Comments</h2>
                {commentsCursor && (
                  <button className="px-3 py-1 rounded border hover:bg-gray-50 text-sm" onClick={() => fetchComments(commentsCursor)}>
                    Load older
                  </button>
                )}
              </div>

              {/* New comment */}
              <div className="space-y-2">
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Write a comment…"
                  className="border rounded-lg px-3 py-2 w-full min-h-[80px]"
                />
                <div className="flex gap-2">
                  <button onClick={addComment} disabled={addingComment || !newBody.trim()} className="px-3 py-1 rounded border hover:bg-gray-50 text-sm">
                    {addingComment ? "Posting…" : "Post"}
                  </button>
                  {!!newBody && (
                    <button onClick={() => setNewBody("")} disabled={addingComment} className="px-3 py-1 rounded border hover:bg-gray-50 text-sm">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Comments list */}
              {comments.length === 0 ? (
                <div className="text-gray-600 text-sm">No comments yet.</div>
              ) : (
                <ul className="space-y-3">
                  {comments.map((c) => {
                    const isBusy = !!busyComment[c.id];
                    return (
                      <li key={c.id} className="border rounded-lg p-3">
                        <div className="text-xs text-gray-500">{new Date(c.created_at).toLocaleString()}</div>
                        <div className="whitespace-pre-wrap text-sm my-1">{c.body}</div>
                        <div className="flex justify-end">
                          <button
                            disabled={isBusy}
                            onClick={() => deleteComment(c.id)}
                            className="px-2 py-1 rounded border hover:bg-gray-50 text-xs"
                            title="Delete"
                          >
                            {isBusy ? "…" : "Delete"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
