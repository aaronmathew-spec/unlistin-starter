import Link from "next/link";
import { BROKERS } from "@/lib/brokers";

export const dynamic = "force-static";

export default function BrokersIndexPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Data Broker & Platform Removal Guides</h1>
      <p className="text-sm text-gray-600">
        Step-by-step instructions to reduce your exposure. We keep India-first coverage, and add
        global platforms that commonly leak personal data.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {BROKERS.map((b) => (
          <Link
            key={b.slug}
            href={`/docs/data-brokers/${b.slug}`}
            className="border rounded-lg p-4 bg-white hover:bg-gray-50"
          >
            <div className="font-medium">{b.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              {b.category} · {b.country}
            </div>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-500">
        Guides are informational. Some removals require contacting the broker or verifying identity.
      </p>
    </main>
  );
}
