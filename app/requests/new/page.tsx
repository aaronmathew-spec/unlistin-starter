"use client";

import { useMemo } from "react";
import Link from "next/link";

function getParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

export default function NewRequestPage() {
  const broker = useMemo(() => getParam("broker"), []);
  const category = useMemo(() => getParam("category"), []);
  const url = useMemo(() => getParam("url"), []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Create removal request</h1>
      <p className="mt-2 text-sm text-gray-600">
        This is a preview-only flow for demos. We do not store your identifiers.
      </p>

      <div className="mt-6 rounded-2xl border border-gray-200 p-6 shadow-sm">
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <dt className="text-gray-500">Source</dt>
          <dd className="col-span-2">{broker || "—"}</dd>

          <dt className="text-gray-500">Category</dt>
          <dd className="col-span-2">{category || "—"}</dd>

          <dt className="text-gray-500">Evidence URL</dt>
          <dd className="col-span-2">
            {url ? (
              <a href={url} className="underline underline-offset-4" target="_blank" rel="noopener noreferrer">
                {url}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </dl>

        <div className="mt-6 flex gap-3">
          <Link
            href={`/api/requests?mode=auto&broker=${encodeURIComponent(broker)}&url=${encodeURIComponent(url)}`}
            className="rounded-xl bg-black px-4 py-2 text-sm text-white"
          >
            Start automated removal (demo)
          </Link>
          <Link
            href={`/api/requests?mode=manual&broker=${encodeURIComponent(broker)}&url=${encodeURIComponent(url)}`}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm"
          >
            Create manual request (demo)
          </Link>
        </div>

        <p className="mt-4 text-xs text-gray-500">
          In Mega Batch 1, this will create a customer record and guide a full removal workflow (Stripe/Razorpay, RBAC, audit logs).
        </p>
      </div>
    </div>
  );
}
