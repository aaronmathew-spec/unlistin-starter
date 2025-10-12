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

type ToastKind = "info" | "success" | "error";

type Toast = { id: number; message: string; ttlMs: number; kind: ToastKind };
type ToastApi = {
  /** Back-compat: your pages already call useToast().toast(...) */
  toast: (message: string, opts?: { ttlMs?: number; kind?: ToastKind }) => void;
  /** Optional convenience helpers */
  success: (message: string, ttlMs?: number) => void;
  error: (message: string, ttlMs?: number) => void;
  info: (message: string, ttlMs?: number) => void;
};

const NOOP_API: ToastApi = {
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * useToast is SSR/prerender-safe.
 * Returns a no-op API if provider isn't mounted during static generation.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? NOOP_API;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const idRef = useRef(1);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    // Cleanup pending timers if provider unmounts
    return () => {
      Object.values(timeouts.current).forEach(clearTimeout);
      timeouts.current = {};
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      toast: (message: string, opts?: { ttlMs?: number; kind?: ToastKind }) => {
        const id = idRef.current++;
        const ttlMs = Math.max(800, Math.min(60_000, opts?.ttlMs ?? 3500));
        const kind: ToastKind = opts?.kind ?? "info";
        setToasts((prev) => [...prev, { id, message, ttlMs, kind }]);

        timeouts.current[id] = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          delete timeouts.current[id];
        }, ttlMs);
      },
      success: (message, ttlMs) => {
        (api as ToastApi).toast(message, { ttlMs, kind: "success" });
      },
      error: (message, ttlMs) => {
        (api as ToastApi).toast(message, { ttlMs, kind: "error" });
      },
      info: (message, ttlMs) => {
        (api as ToastApi).toast(message, { ttlMs, kind: "info" });
      },
    }),
    []
  );

  // ESC to close the most recent toast (handy in dev)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setToasts((prev) => prev.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toasts container (simple, dependency-free) */}
      <div
        aria-live="polite"
        role="status"
        className="fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto max-w-[92vw] sm:max-w-md w-fit rounded-lg border shadow-lg px-3 py-2 text-sm",
              t.kind === "success" && "bg-green-50 border-green-300 text-green-900",
              t.kind === "error" && "bg-red-50 border-red-300 text-red-900",
              t.kind === "info" && "bg-white border-gray-200 text-gray-800",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Default export to satisfy `import ToastProvider from '...'` call sites */
export default ToastProvider;
