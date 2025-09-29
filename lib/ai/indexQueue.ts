export async function queueIndex(kind: "request" | "file", id: number) {
  try {
    // If backend AI is disabled, do nothing (safe no-op).
    if (process.env.FEATURE_AI_SERVER !== "1") return;

    // Relative URL works in Vercel serverless; fall back to SITE_URL if set.
    const base =
      (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "") || "";
    const url = (base ? `${base}` : "") + "/api/ai/index";

    await fetch(url || "/api/ai/index", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // keep it fire-and-forget — we don’t block the user flow on AI indexing
      body: JSON.stringify({ kind, id }),
      // Don’t reject on non-2xx; we just try and move on.
      // (If you want strict behavior, check response.ok and log.)
    }).catch(() => {});
  } catch {
    // Swallow errors — normal UX must never break due to indexing
  }
}
