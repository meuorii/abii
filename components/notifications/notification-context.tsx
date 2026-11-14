"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type NotificationContextValue = {
  unreadCount: number | null;
  studyTimezone: string;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children, userId, studyTimezone }: { children: ReactNode; userId: string; studyTimezone: string }) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-count", { cache: "no-store" });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "unreadCount" in payload && typeof payload.unreadCount === "number" && Number.isInteger(payload.unreadCount) && payload.unreadCount >= 0) setUnreadCount(payload.unreadCount);
    } catch { /* Notification sync must not hold up the authenticated shell. */ }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();
    const onFocus = () => { if (document.visibilityState === "visible") void refreshUnreadCount(); };
    const onVisibility = () => { if (document.visibilityState === "visible") void refreshUnreadCount(); };
    const onChanged = () => { void refreshUnreadCount(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("abii:notifications-changed", onChanged);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("abii:notifications-changed", onChanged);
    };
  }, [userId, refreshUnreadCount]);

  const value = useMemo(() => ({ unreadCount, studyTimezone, refreshUnreadCount }), [unreadCount, studyTimezone, refreshUnreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("useNotifications must be used inside NotificationProvider.");
  return value;
}

export function notifyStateChanged(): void {
  window.dispatchEvent(new Event("abii:notifications-changed"));
}
