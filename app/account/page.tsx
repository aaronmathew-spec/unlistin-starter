// app/account/page.tsx
"use client";

export default function AccountPage() {
  // Keep simple and build-safe without hitting backend:
  // We can enrich later with Supabase profile + entitlements.
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <div className="mt-4 rounded-2xl border border-gray-200 p-6 shadow-sm text-sm text-gray-700">
        <p>Manage profile, locale, currency, and billing details.</p>
        <p className="mt-2">For billing, see <a className="underline" href="/billing">Billing</a>.</p>
      </div>
    </div>
  );
}
