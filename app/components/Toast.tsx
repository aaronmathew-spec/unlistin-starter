"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Toast = {
  id: number;
  title?: string;
  message: string;
  variant?: "default" | "success" | "error";
  timeoutMs?: number;
};

type Ctx = {
  toast: (t: Omit<Toast, "id">) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1_000_000);
    const item: Toast = { id, variant: "default", timeoutMs: 3500, ...t };
    setItems((prev) => [...prev, item]);
    const ttl = item.timeoutMs!;
    if (ttl > 0) {
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, ttl);
    }
  }, []);

  const value = useMemo<Ctx>(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed z-[1000] bottom-4 right-4 space-y-2 w-[min(92vw,360px)]">
        {items.map((t) => (
          <div
            key={t.id}
            className={[
              "border rounded-lg px-3 py-2 shadow-sm text-sm bg-white",
              t.variant === "success" ? "border-emerald-300" : "",
              t.variant === "error" ? "border-red-300" : "",
            ].join(" ")}
          >
            {t.title ? <div className="font-medium">{t.title}</div> : null}
            <div className="text-gray-700">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
