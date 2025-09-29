// lib/fileIcons.tsx
import React from "react";

export function fileEmoji(mime?: string | null, name?: string) {
  const n = (name || "").toLowerCase();
  const m = (mime || "").toLowerCase();

  if (m.startsWith("image/")) return "🖼️";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "📄";
  if (m.includes("zip") || n.endsWith(".zip") || n.endsWith(".rar") || n.endsWith(".7z")) return "🗜️";
  if (m.includes("spreadsheet") || n.endsWith(".xlsx") || n.endsWith(".csv")) return "📊";
  if (m.includes("presentation") || n.endsWith(".ppt") || n.endsWith(".pptx")) return "📽️";
  if (m.includes("word") || n.endsWith(".doc") || n.endsWith(".docx")) return "📝";
  if (m.startsWith("audio/")) return "🎵";
  if (m.startsWith("video/")) return "🎬";
  if (n.endsWith(".txt") || m.startsWith("text/")) return "📃";
  return "📦";
}

export function humanSize(bytes?: number | null) {
  const v = typeof bytes === "number" ? bytes : 0;
  if (v < 1024) return `${v} B`;
  const kb = v / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}
