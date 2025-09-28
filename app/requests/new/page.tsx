"use client";

import { useState } from "react";

export default function NewRequestPage() {
  const [site, setSite] = useState("");
  const [category, setCategory] = useState("Search Engine");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_url: site,
          category,
          notes
        }),
        credentials: "include"
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to create request");
        return;
      }

      window.location.href = "/requests";
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>New Removal Request</h1>

      <label>Site URL</label>
      <input value={site} onChange={(e) => setSite(e.target.value)} required style={{ width: "100%" }} />

      <label style={{ marginTop: 16 }}>Category</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
        <option>Search Engine</option>
        <option>Social Network</option>
        <option>News/Media</option>
        <option>Other</option>
      </select>

      <label style={{ marginTop: 16 }}>Notes</label>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} style={{ width: "100%" }} />

      <button type="submit" disabled={saving} style={{ marginTop: 20 }}>
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
