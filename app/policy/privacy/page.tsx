// app/policy/privacy/page.tsx

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <div className="prose mt-6 max-w-none">
        <p>
          Unlistin is built privacy-first: Quick Scan operates without persisting inputs; Deep Scan
          stores only the minimum necessary to process requests and generate evidence, encrypted at
          rest. We never sell personal data.
        </p>
        <h3>Data We Process</h3>
        <ul>
          <li>Quick Scan inputs (ephemeral, not stored)</li>
          <li>Deep Scan request details (encrypted)</li>
          <li>Evidence artifacts and manifests (signed)</li>
        </ul>
        <h3>Your Rights</h3>
        <p>
          You can request access or deletion of your Unlistin account records. For controller-side
          data, we coordinate lawful requests and track outcomes.
        </p>
        <h3>Security</h3>
        <p>
          RLS-enforced storage, strict CSP, short-lived links, signed manifests, and tamper-evident
          bundles. Incident response and audit logs are maintained.
        </p>
        <h3>Contact</h3>
        <p>
          Email <a href="mailto:privacy@unlistin.app">privacy@unlistin.app</a> for privacy queries.
        </p>
      </div>
    </div>
  );
}
