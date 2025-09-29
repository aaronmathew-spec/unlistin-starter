"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Toast = { id: number; message: string; type?: "success" | "error" | "info" };
const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (t: Omit<Toast, "id">) =>
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), ...t }]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 2500)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed z-[9999] top-4 right-4 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "min-w-[220px] max-w-[360px] rounded-lg px-3 py-2 shadow border text-sm",
              t.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
              t.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
              "bg-gray-50 border-gray-200 text-gray-800"
            ].join(" ")}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
