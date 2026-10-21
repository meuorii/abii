"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; title: string; message?: string; kind: ToastKind };
type ToastContextValue = { toast: (item: Omit<ToastItem, "id">) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider.");
  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((item: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current.slice(-3), { ...item, id }]);
    window.setTimeout(() => setItems((current) => current.filter((entry) => entry.id !== id)), 3800);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-[380px] flex-col gap-2" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} role={item.kind === "error" ? "alert" : "status"} className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-[0_12px_40px_rgba(47,41,48,0.14)] animate-[abii-toast-in_180ms_ease-out] motion-reduce:animate-none ${item.kind === "success" ? "border-[#C5EBD5]" : item.kind === "error" ? "border-[#F3C7D2]" : "border-[#E8E2E5]"}`}>
            <span aria-hidden="true" className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${item.kind === "success" ? "bg-[#EAF8F0] text-[#248553]" : item.kind === "error" ? "bg-[#FFF1F1] text-[#C34465]" : "bg-[#FFE8EF] text-[#C65380]"}`}>
              {item.kind === "success" ? "✓" : item.kind === "error" ? "!" : "i"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#2F2930]">{item.title}</p>
              {item.message && <p className="mt-1 text-xs leading-5 text-[#756B72]">{item.message}</p>}
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} className="rounded-md px-1 text-lg leading-5 text-[#8C7F87] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
