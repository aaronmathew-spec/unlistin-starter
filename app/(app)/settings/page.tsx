// app/(app)/settings/page.tsx
"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [locale, setLocale] = useState<"en" | "hi">("en");
  const [tz, setTz] = useState("Asia/Kolkata");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setNote(null);
    try {
      // TODO: call your settings API
      await new Promise((r) => setTimeout(r, 700));
      setNote("Saved.");
    } catch {
      setNote("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs text-[color:var(--muted)]">Account</div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Settings</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h3 className="text-sm font-semibold">Profile</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="name">Display Name</label>
              <input id="name" className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div>
              <label className="label" htmlFor="locale">Preferred Language</label>
              <select id="locale" className="input" value={locale} onChange={(e) => setLocale(e.target.value as any)}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="tz">Time Zone</label>
              <input id="tz" className="input" value={tz} onChange={(e) => setTz(e.target.value)} />
            </div>

            <button className="btn" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {note ? <div className="text-sm text-[color:var(--muted)]">{note}</div> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-6">
          <h3 className="text-sm font-semibold">Security</h3>
          <div className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
            <div>• SSO/SAML (Enterprise)</div>
            <div>• Session length: 12h (renewal tokens)</div>
            <div>• Device approvals & sign-out everywhere</div>
          </div>
          <div className="mt-4">
            <button className="btn-outline px-4 py-2 rounded-full">Reset Password</button>
          </div>
        </section>
      </div>
    </div>
  );
}
