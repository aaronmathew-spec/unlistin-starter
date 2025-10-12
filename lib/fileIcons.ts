// lib/fileIcons.ts

/** Human friendly file size (e.g., 1.2 MB) */
export function humanSize(bytes: number | null | undefined): string {
  const b = typeof bytes === "number" && bytes >= 0 ? bytes : 0;
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let i = -1;
  let n = b;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < units.length - 1);
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

/** Best-effort emoji for a file based on mime and/or name */
export function fileEmoji(mime?: string | null, name?: string | null): string {
  const m = (mime || "").toLowerCase();
  const n = (name || "").toLowerCase();

  const ext = (() => {
    const i = n.lastIndexOf(".");
    return i >= 0 ? n.slice(i + 1) : "";
  })();

  // MIME-led checks
  if (m.startsWith("image/")) return "🖼️";
  if (m.startsWith("video/")) return "🎞️";
  if (m.startsWith("audio/")) return "🎵";
  if (m === "application/pdf") return "📕";
  if (m.includes("zip") || m.includes("compressed")) return "🗜️";
  if (m.includes("json")) return "🧾";
  if (m.includes("csv")) return "🧮";
  if (m.includes("html")) return "🌐";
  if (m.includes("text")) return "📄";

  // Extension fallbacks
  switch (ext) {
    case "pdf":
      return "📕";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return "🖼️";
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
    case "webm":
      return "🎞️";
    case "mp3":
    case "wav":
    case "aac":
    case "flac":
      return "🎵";
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return "🗜️";
    case "csv":
      return "🧮";
    case "json":
      return "🧾";
    case "html":
    case "htm":
      return "🌐";
    case "txt":
    case "md":
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
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "rb":
    case "go":
    case "java":
    case "cs":
    case "rs":
    case "php":
    case "sh":
    case "yml":
    case "yaml":
    case "toml":
      return "🧑‍💻";
    default:
      return "📄";
  }
}
