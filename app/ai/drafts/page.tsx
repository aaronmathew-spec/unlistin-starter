// app/ai/drafts/page.tsx
"use client";

import { useState } from "react";

type DraftResp = {
  ok: boolean;
  draft?: {
    subject: string;
    body: string;
    fields: {
      action: "remove" | "correct" | "remove_or_correct";
      data_categories: string[];
      legal_basis: string;
      reply_to_hint: string;
    };
    attachments: { name: string; kind: string; rationale: string }[];
  };
  error?: string;
};

export default function DraftsPage() {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<DraftResp | null>(null);
  const [broker, setBroker] = useState("Justdial");
  // Redacted previews only – never capture raw PII in UI state.
  const [namePreview, setNamePreview] = useState("N•");
  const [emailPreview, setEmailPreview] = useState("e•@•");
  const [cityPreview, setCityPreview] = useState("C•");
  const [note, setNote] = useState("Listing appears to expose profile info.");

  async function generateDraft() {
    setLoading(true);
    setResp(null);
    try {
      const r = await fetch("/api/ai/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          broker,
          category: "directory",
          intent: "remove_or_correct",
          context: {
            namePreview,
            emailPreview,
            cityPreview,
            exposureNotes: [note],
          },
          evidence: [
            // Example allowlisted link; user can replace with actual allowlisted URLs from Quick Scan
            { url: "https://support.mozilla.org/", note: "General exposure guidance" },
          ],
          preferences: {
            attachmentsAllowed: true,
            replyChannel: "email",
            replyEmailPreview: emailPreview,
          },
        }),
      });
      const j = (await r.json()) as DraftResp;
      setResp(j);
    } catch (e) {
      setResp({ ok: false, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">AI Removal Drafts</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Generates a broker-ready draft using redacted previews and allowlisted evidence.
        No PII is stored or sent to your browser.
      </p>

      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 text-muted-foreground">Broker</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                placeholder="Justdial"
              />
            </label>
            <label className="text-sm">
              <div className="mb-1 text-muted-foreground">Name (redacted)</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={namePreview}
                onChange={(e) => setNamePreview(e.target.value)}
                placeholder="N•"
              />
            </label>
            <label className="text-sm">
              <div className="mb-1 text-muted-foreground">Email (redacted)</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={emailPreview}
                onChange={(e) => setEmailPreview(e.target.value)}
                placeholder="e•@•"
              />
            </label>
            <label className="text-sm">
              <div className="mb-1 text-muted-foreground">City (redacted)</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={cityPreview}
                onChange={(e) => setCityPreview(e.target.value)}
                placeholder="C•"
              />
            </label>
            <label className="text-sm md:col-span-2">
              <div className="mb-1 text-muted-foreground">Exposure note (redacted)</div>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Listing appears to expose profile info."
              />
            </label>
          </div>

          <div className="mt-4">
            <button
              onClick={generateDraft}
              disabled={loading}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
            >
              {loading ? "Generating…" : "Generate Draft"}
            </button>
          </div>
        </div>

        {resp && (
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            {!resp.ok && (
              <div className="text-sm text-red-500">Error: {resp.error || "Unknown error"}</div>
            )}
            {resp.ok && resp.draft && (
              <>
                <div className="text-sm">
                  <div className="font-semibold">Subject</div>
                  <div className="mt-1 rounded-md border bg-background px-3 py-2">{resp.draft.subject}</div>
                </div>

                <div className="mt-4 text-sm">
                  <div className="font-semibold">Body</div>
                  <textarea
                    className="mt-1 h-56 w-full rounded-md border bg-background p-3 text-sm"
                    value={resp.draft.body}
                    readOnly
                  />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="text-sm">
                    <div className="font-semibold">Fields</div>
                    <div className="mt-1 rounded-md border bg-background p-3">
                      <div>Action: {resp.draft.fields.action}</div>
                      <div>Legal basis: {resp.draft.fields.legal_basis}</div>
                      <div className="mt-1">
                        Data categories:
                        <ul className="ml-5 list-disc">
                          {resp.draft.fields.data_categories.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-1 text-muted-foreground text-xs">{resp.draft.fields.reply_to_hint}</div>
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-semibold">Attachments (suggested)</div>
                    <div className="mt-1 rounded-md border bg-background p-3">
                      {resp.draft.attachments.length === 0 && <div className="text-muted-foreground">None</div>}
                      {resp.draft.attachments.map((a, i) => (
                        <div key={i} className="mb-2">
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.kind}</div>
                          <div className="text-xs mt-1">{a.rationale}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
