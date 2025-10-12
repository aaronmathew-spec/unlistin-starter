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

function ext(nameOrMime: string): string {
  const s = nameOrMime.toLowerCase().trim();
  // MIME shortcuts
  if (s.includes("/pdf")) return "pdf";
  if (s.includes("word") || s.includes("officedocument.word")) return "docx";
  if (s.includes("excel") || s.includes("spreadsheetml")) return "xlsx";
  if (s.includes("powerpoint") || s.includes("presentationml")) return "pptx";
  if (s.includes("image/")) return "img";
  if (s.includes("text/html")) return "html";
  if (s.includes("text/plain")) return "txt";
  // Filename-based
  const m = /\.([a-z0-9]+)$/.exec(s);
  return m ? m[1] : s;
}

/** Small, dependency-free emoji “icons” for files shown in UI lists. */
export function fileEmoji(nameOrMime?: string): string {
  const e = ext(nameOrMime || "");
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
