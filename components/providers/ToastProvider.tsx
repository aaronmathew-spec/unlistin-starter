"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  PropsWithChildren,
} from "react";

type Toast = { id: number; message: string; ttlMs: number };
type ToastApi = {
  toast: (message: string, opts?: { ttlMs?: number }) => void;
};

const NOOP_API: ToastApi = {
  toast: () => {
    // SSR / prerender safe: do nothing if provider isn't mounted yet
  },
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * useToast is SSR/prerender-safe.
 * If the provider isn't available during build-time evaluation,
 * this returns a no-op API to avoid crashes.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? NOOP_API;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const idRef = useRef(1);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const api = useMemo<ToastApi>(
    () => ({
      toast: (message: string, opts?: { ttlMs?: number }) => {
        const id = idRef.current++;
        const ttlMs = Math.max(800, Math.min(60_000, opts?.ttlMs ?? 3500));
        setToasts((prev) => [...prev, { id, message, ttlMs }]);
        // auto-remove
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, ttlMs);
      },
    }),
    []
  );

  // Escape to close the most recent toast quickly (nice for dev)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setToasts((prev) => prev.slice(0, -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Simple toasts container */}
      <div
        aria-live="polite"
        className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto max-w-[92vw] sm:max-w-md w-fit rounded-lg border bg-white shadow-lg px-3 py-2 text-sm text-gray-800"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
