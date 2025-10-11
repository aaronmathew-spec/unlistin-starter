export type SupportedKind = "pdf" | "docx" | "html";

function routeFor(kind: SupportedKind) {
  if (kind === "pdf") return "/api/tools/pdf-to-text";
  if (kind === "docx") return "/api/tools/docx-to-text";
  return "/api/tools/html-to-text";
}

export async function extractFileToText(kind: SupportedKind, file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(routeFor(kind), { method: "POST", body: fd });
  if (!res.ok) {
    throw new Error(`extractor ${kind} failed: ${await res.text()}`);
  }
  const json = await res.json();
  return json.text || "";
}
