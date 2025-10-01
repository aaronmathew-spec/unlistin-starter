export const dynamic = "force-static";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Hero */}
      <section className="rounded-2xl border bg-white p-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold">
            Unlistin — Remove your personal data from the web
          </h1>
          <p className="text-gray-600">
            India-first, AI-assisted privacy removal. Start with a{" "}
            <strong>Quick Scan</strong> — no sign-up, no data stored — and
            preview where your information likely appears.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/scan/quick"
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Run Quick Scan
            </Link>
            <Link
              href="/docs/data-brokers"
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Removal Guides
            </Link>
            <Link
              href="/login"
              className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Sign in
            </Link>
          </div>

          <p className="text-xs text-gray-500">
            We never store Quick Scan inputs. For full scan & automated removals, sign in and give
            consent.
          </p>
        </div>
      </section>

      {/* Value props */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-medium">AI-assisted</h3>
          <p className="text-sm text-gray-600 mt-1">
            Our assistant prioritizes removals and drafts requests with human-like quality.
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-medium">India coverage</h3>
          <p className="text-sm text-gray-600 mt-1">
            Focus on Indian data brokers & search surfaces, plus global platforms.
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h3 className="font-medium">No PII stored by default</h3>
          <p className="text-sm text-gray-600 mt-1">
            Quick Scan is zero-retention. Full flow stores only with explicit consent.
          </p>
        </div>
      </section>

      {/* Helpful links */}
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-semibold mb-3">Explore</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            <Link className="underline hover:no-underline" href="/scan/quick">
              Quick Scan (no data stored)
            </Link>
          </li>
          <li>
            <Link className="underline hover:no-underline" href="/ai">
              Ask the AI assistant
            </Link>{" "}
            <span className="text-gray-500">(feature-flagged)</span>
          </li>
          <li>
            <Link className="underline hover:no-underline" href="/docs/data-brokers">
              Data broker removal guides
            </Link>
          </li>
          <li>
            <Link className="underline hover:no-underline" href="/requests">
              Your requests dashboard
            </Link>
          </li>
        </ul>
      </section>

      <p className="text-xs text-gray-500">
        © {new Date().getFullYear()} Unlistin. Built for privacy, security, and clarity.
      </p>
    </main>
  );
}
