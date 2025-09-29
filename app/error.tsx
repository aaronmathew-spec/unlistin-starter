"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/components/providers/ToastProvider";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  const { toast } = useToast();

  useEffect(() => {
    // Lightweight signal; avoid noisy loops
    toast("Something went wrong. You can retry.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <html>
      <body className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full border rounded-xl p-4 space-y-3">
          <h1 className="text-lg font-semibold">Unexpected error</h1>
          <p className="text-sm text-gray-700">{error.message || "Unknown error"}</p>
          {error.digest && (
            <p className="text-xs text-gray-500">Digest: {error.digest}</p>
          )}
          <div className="flex gap-2">
            <button onClick={reset} className="px-3 py-2 rounded border hover:bg-gray-50">
              Try again
            </button>
            <Link href="/" className="px-3 py-2 rounded border hover:bg-gray-50">
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
