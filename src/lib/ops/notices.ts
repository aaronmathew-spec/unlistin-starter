// src/lib/ops/notices.ts
export function getNoticeFromSearch(
  searchParams?: Record<string, string | string[] | undefined>
):
  | { kind: "ok" | "error"; message: string }
  | null {
  if (!searchParams) return null;
  const err =
    typeof searchParams.err === "string" ? searchParams.err.trim() : "";
  if (err) return { kind: "error", message: decodeURIComponent(err) };

  const ok = typeof searchParams.ok === "string" ? searchParams.ok.trim() : "";
  const note =
    typeof searchParams.note === "string" ? searchParams.note.trim() : "";
  if (ok || note) {
    return {
      kind: "ok",
      message: decodeURIComponent(note || "ok"),
    };
  }
  return null;
}
