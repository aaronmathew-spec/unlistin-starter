// app/ops/system/ExportButton.tsx
"use client";

import { useState } from "react";

export default function ExportButton() {
  const [subjectId, setSubjectId] = useState("");

  const onClick = () => {
    if (!subjectId.trim()) return;
    const url = `/api/proofs/${encodeURIComponent(subjectId)}/export`;
    // Force download
    window.location.href = url;
  };

  return (
    <div className="flex items-center gap-2">
      <input
        placeholder="Subject ID"
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
        className="border rounded px-2 py-1"
      />
      <button
        className="px-3 py-1 rounded bg-black text-white"
        onClick={onClick}
      >
        Export KMS-Signed Bundle
      </button>
    </div>
  );
}
