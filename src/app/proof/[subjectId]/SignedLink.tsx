// src/app/proof/[subjectId]/SignedLink.tsx
"use client";

import { useState } from "react";

export function SignedLink({
  subjectId,
  path,
  label,
}: {
  subjectId: string;
  path: string;
  label: string;
}) {
  const [href, setHref] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function getUrl() {
    try {
      setLoading(true);
      const res = await fetch("/api/proofs/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId, path }),
      });
      const j = await res.json();
      if (res.ok) setHref(j.url);
      else alert(j.error || "Failed to sign URL");
    } catch (e: any) {
      alert(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return href ? (
    <a className="underline text-blue-600" href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : (
    <button
      className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
      onClick={getUrl}
      disabled={loading}
      aria-label={`Get signed URL for ${label}`}
    >
      {loading ? "…" : label}
    </button>
  );
}
