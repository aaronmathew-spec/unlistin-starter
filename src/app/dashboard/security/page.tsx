export default function SecurityIndex() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-2">Security & Integrations</h1>
      <p className="text-sm text-neutral-600">Manage API access and webhook integrations.</p>

      <div className="grid gap-4 mt-6">
        <a href="/dashboard/security/keys" className="border rounded-xl p-4 hover:bg-neutral-50">
          <div className="font-medium">API Keys</div>
          <div className="text-sm text-neutral-600">Create and revoke Personal Access Tokens.</div>
        </a>
        <a href="/dashboard/security/webhooks" className="border rounded-xl p-4 hover:bg-neutral-50">
          <div className="font-medium">Webhooks</div>
          <div className="text-sm text-neutral-600">Receive signed delivery events in your systems.</div>
        </a>
      </div>
    </div>
  );
}
