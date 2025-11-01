// app/help/page.tsx

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Help & Support</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Quick answers to common questions. Still stuck? Email us at{" "}
        <a href="mailto:support@unlistin.app" className="underline">support@unlistin.app</a>.
      </p>

      <div className="mt-6 space-y-4">
        <Faq q="What does Quick Scan do?" a="It runs redacted checks against allowlisted sources and shows preview-only evidence. Nothing you enter is stored." />
        <Faq q="How is Deep Scan different?" a="With consent, we enrich results, automate controller follow-ups, and generate signed evidence bundles for audit." />
        <Faq q="Can I export my evidence?" a="Yes. You can download signed, tamper-evident bundles as ZIP files." />
        <Faq q="Is my data stored?" a="Quick Scan stores nothing. Deep Scan stores only what’s needed to process requests, encrypted at rest, with retention controls." />
        <Faq q="Do you support global laws?" a="We start India-first and expand globally. The platform is built to support regional rules and controller nuances." />
      </div>

      <div className="mt-8 rounded-2xl border bg-card p-6">
        <div className="text-sm font-medium">Need a hand with a specific controller?</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Share the controller name/URL and (optionally) a redacted screenshot. We’ll guide you.
        </p>
        <a
          href="mailto:support@unlistin.app?subject=Controller%20help"
          className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Email Support
        </a>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-sm font-medium">{q}</div>
      <div className="mt-1 text-sm text-muted-foreground">{a}</div>
    </div>
  );
}
