/* lib/fileIcons.ts */

export function humanSize(bytes?: number | null): string {
  if (bytes == null || isNaN(bytes as any)) return "-";
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
}

function extFromFilename(name?: string | null): string | null {
  if (!name) return null;
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : null;
}

function extFromMime(mime?: string | null): string | null {
  if (!mime) return null;
  const s = mime.toLowerCase().trim();
  if (!s.includes("/")) return null;

  if (s.includes("/pdf")) return "pdf";
  if (s.includes("word") || s.includes("officedocument.word")) return "docx";
  if (s.includes("excel") || s.includes("spreadsheetml")) return "xlsx";
  if (s.includes("powerpoint") || s.includes("presentationml")) return "pptx";
  if (s.startsWith("image/")) return "img";
  if (s === "text/html") return "html";
  if (s === "text/plain") return "txt";
  if (s === "text/markdown") return "md";
  if (s === "application/json") return "json";
  if (s === "text/csv") return "csv";
  return null;
}

/**
 * Emoji file “icon”.
 * Accepts either (filename) OR (mime, filename). Both optional.
 * We prefer mime when present, with filename as a fallback.
 */
export function fileEmoji(
  mimeOrName?: string | null,
  filenameMaybe?: string | null
): string {
  const looksLikeMime = !!mimeOrName && mimeOrName.includes("/");
  const mime = looksLikeMime ? mimeOrName : undefined;
  const filename = looksLikeMime ? filenameMaybe : mimeOrName;

  const byMime = extFromMime(mime);
  const byName = extFromFilename(filename);
  const e = (byMime || byName || "").toLowerCase();

  switch (e) {
    case "pdf":
      return "📄";
    case "doc":
    case "docx":
      return "📝";
    case "xls":
    case "xlsx":
      return "📊";
    case "ppt":
    case "pptx":
      return "📈";
    case "csv":
      return "🧾";
    case "zip":
    case "rar":
    case "7z":
      return "📦";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
    case "img":
      return "🖼️";
    case "html":
    case "htm":
      return "🌐";
    case "txt":
      return "📃";
    case "json":
      return "🧩";
    case "md":
    case "markdown":
      return "🗒️";
    default:
      return "📎";
  }
}
