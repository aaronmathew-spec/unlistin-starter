// app/policy/terms/page.tsx

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <div className="prose mt-6 max-w-none">
        <h3>Service</h3>
        <p>
          Unlistin facilitates lawful data deletion and opt-out requests on your behalf. Outcomes
          depend on each controller’s policies and applicable law.
        </p>
        <h3>Acceptable Use</h3>
        <p>
          You agree to provide accurate information and not misuse the platform to harass, defraud,
          or violate laws.
        </p>
        <h3>Disclaimers</h3>
        <p>
          We do not guarantee removal in all cases; we provide best-effort automation and evidence.
        </p>
        <h3>Liability</h3>
        <p>
          To the maximum extent permitted by law, Unlistin’s aggregate liability is limited to the
          fees paid for the service period in question.
        </p>
        <h3>Contact</h3>
        <p>
          For legal questions, email <a href="mailto:legal@unlistin.app">legal@unlistin.app</a>.
        </p>
      </div>
    </div>
  );
}
