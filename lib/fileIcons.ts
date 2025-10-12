/* Minimal file icon helper used by coverage / files pages. No external deps. */

export type FileIcon = {
  emoji: string;
  label: string;
  className?: string; // optional Tailwind class if you want to style badges
};

export function getFileIcon(nameOrMime: string): FileIcon {
  const s = (nameOrMime || "").toLowerCase();

  const byExt = (ext: string, icon: FileIcon) =>
    s.endsWith(`.${ext}`) ? icon : null;

  const candidates: (FileIcon | null)[] = [
    s.includes("pdf") ? { emoji: "📄", label: "PDF", className: "text-red-600" } : null,
    byExt("pdf", { emoji: "📄", label: "PDF", className: "text-red-600" }),
    byExt("doc", { emoji: "📝", label: "DOC" }),
    byExt("docx", { emoji: "📝", label: "DOCX" }),
    byExt("txt", { emoji: "📜", label: "Text" }),
    byExt("csv", { emoji: "🧮", label: "CSV" }),
    byExt("xls", { emoji: "📊", label: "XLS" }),
    byExt("xlsx", { emoji: "📊", label: "XLSX" }),
    byExt("png", { emoji: "🖼️", label: "PNG" }),
    byExt("jpg", { emoji: "🖼️", label: "JPG" }),
    byExt("jpeg", { emoji: "🖼️", label: "JPG" }),
    byExt("gif", { emoji: "🖼️", label: "GIF" }),
    byExt("zip", { emoji: "🗜️", label: "ZIP" }),
    byExt("json", { emoji: "🧩", label: "JSON" }),
    byExt("html", { emoji: "🌐", label: "HTML" }),
  ];

  const found = candidates.find(Boolean);
  return found || { emoji: "📦", label: "File" };
}
