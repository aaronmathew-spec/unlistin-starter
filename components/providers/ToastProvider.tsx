"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Toast = { id: number; text: string };

const ToastCtx = createContext<{
  toast: (text: string) => void;
} | null>(null);

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const api = useMemo(
    () => ({
      toast(text: string) {
        const id = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((t) => [...t, { id, text }]);
        setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
        }, 2500);
      },
    }),
    []
  );

  return (
    <ToastCtx.Provider value={api}>
      {/* portal-ish container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-3 py-2 rounded-lg shadow bg-black/80 text-white text-sm"
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
