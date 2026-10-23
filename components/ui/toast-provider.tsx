"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toastConfig } from "@/components/ui/toast-config";
import { ToastCard, type ToastInput, type ToastRecord } from "@/components/ui/toast";

type ToastContextValue = { toast: (item: ToastInput) => void };
const ToastContext = createContext<ToastContextValue | null>(null);
type TimerEntry = { timeout: number | null; remaining: number; startedAt: number; paused: boolean; exitTimeout: number | null };

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider.");
  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const [pageHidden, setPageHidden] = useState(false);
  const timers = useRef(new Map<string, TimerEntry>());
  const interactionPaused = useRef(new Set<string>());
  const duplicateKeys = useRef(new Map<string, number>());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const remove = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      if (timer.timeout !== null) window.clearTimeout(timer.timeout);
      if (timer.exitTimeout !== null) window.clearTimeout(timer.exitTimeout);
      timers.current.delete(id);
    }
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (item?.onDismiss) item.onDismiss();
    setItems((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const close = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (!timer || timer.exitTimeout !== null) return;
    if (timer.timeout !== null) window.clearTimeout(timer.timeout);
    timer.timeout = null;
    setItems((current) => current.map((entry) => entry.id === id ? { ...entry, exiting: true } : entry));
    timer.exitTimeout = window.setTimeout(() => remove(id), 200);
  }, [remove]);

  const pause = useCallback((id: string) => {
    interactionPaused.current.add(id);
    const timer = timers.current.get(id);
    if (!timer || timer.paused || timer.timeout === null) return;
    timer.remaining = Math.max(0, timer.remaining - (performance.now() - timer.startedAt));
    window.clearTimeout(timer.timeout);
    timer.timeout = null;
    timer.paused = true;
    setItems((current) => current.map((entry) => entry.id === id ? { ...entry, paused: true } : entry));
  }, []);

  const resume = useCallback((id: string) => {
    interactionPaused.current.delete(id);
    const timer = timers.current.get(id);
    if (!timer || !timer.paused || pageHidden || timer.exitTimeout !== null) return;
    timer.paused = false;
    timer.startedAt = performance.now();
    timer.timeout = window.setTimeout(() => close(id), timer.remaining);
    setItems((current) => current.map((entry) => entry.id === id ? { ...entry, paused: false } : entry));
  }, [close, pageHidden]);

  const toast = useCallback((input: ToastInput) => {
    const key = `${input.kind}\u0000${input.title}\u0000${input.message ?? ""}`;
    const now = Date.now();
    if (now - (duplicateKeys.current.get(key) ?? 0) < 1400) return;
    for (const [duplicateKey, timestamp] of duplicateKeys.current) {
      if (now - timestamp >= 1400) duplicateKeys.current.delete(duplicateKey);
    }
    duplicateKeys.current.set(key, now);
    const id = globalThis.crypto?.randomUUID?.() ?? `${now}-${Math.random().toString(36).slice(2)}`;
    const duration = input.duration ?? toastConfig[input.kind].duration;
    const record: ToastRecord = { ...input, id, duration, exiting: false, paused: pageHidden };
    const live = itemsRef.current.filter((entry) => !entry.exiting);
    if (live.length >= 3) close(live[live.length - 1].id);
    const retained = live.length >= 3 ? live.slice(0, 2) : live;
    const exiting = itemsRef.current.filter((entry) => entry.exiting);
    itemsRef.current = [record, ...retained, ...exiting];
    setItems((current) => [record, ...current.filter((entry) => entry.exiting), ...retained]);
    const timer: TimerEntry = { timeout: null, remaining: duration, startedAt: performance.now(), paused: pageHidden, exitTimeout: null };
    timers.current.set(id, timer);
    if (!input.persistent && !pageHidden) timer.timeout = window.setTimeout(() => close(id), duration);
  }, [close, pageHidden]);

  useEffect(() => {
    const updateVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      setPageHidden(hidden);
      for (const [id, timer] of timers.current) {
        if (hidden && !timer.paused && timer.timeout !== null) {
          timer.remaining = Math.max(0, timer.remaining - (performance.now() - timer.startedAt));
          window.clearTimeout(timer.timeout);
          timer.timeout = null;
          timer.paused = true;
          setItems((current) => current.map((entry) => entry.id === id ? { ...entry, paused: true } : entry));
        } else if (!hidden && timer.paused && !interactionPaused.current.has(id) && timer.exitTimeout === null) {
          timer.paused = false;
          timer.startedAt = performance.now();
          timer.timeout = window.setTimeout(() => close(id), timer.remaining);
          setItems((current) => current.map((entry) => entry.id === id ? { ...entry, paused: false } : entry));
        }
      }
    };
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, [close]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) {
      if (timer.timeout !== null) window.clearTimeout(timer.timeout);
      if (timer.exitTimeout !== null) window.clearTimeout(timer.exitTimeout);
    }
    timers.current.clear();
    interactionPaused.current.clear();
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="abii-toast-stack" aria-label="Notifications">
        {items.map((item) => <ToastCard key={item.id} item={item} onDismiss={close} onPause={pause} onResume={resume} />)}
      </div>
    </ToastContext.Provider>
  );
}
