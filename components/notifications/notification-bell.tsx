"use client";

import { Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast-provider";
import type { NotificationDTO } from "@/lib/notifications/contracts";
import { fetchNotificationPage, markAllNotificationsRead, markNotificationRead } from "./notification-client";
import { NotificationItem } from "./notification-item";
import { formatUnreadCount } from "./notification-display";
import { notifyStateChanged, useNotifications } from "./notification-context";
import Link from "next/link";

export function NotificationBell() {
  const pathname = usePathname();
  const router = useRouter();
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const { toast } = useToast();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 84, right: 16, maxHeight: 680 });
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);
  const measure = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: Math.min(rect.bottom + 8, window.innerHeight - 260), right: Math.max(8, window.innerWidth - rect.right), maxHeight: Math.max(280, window.innerHeight - rect.bottom - 24) });
  }, []);

  const loadRecent = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    void refreshUnreadCount();
    try {
      const page = await fetchNotificationPage({ limit: 5 });
      if (requestRef.current === requestId) setNotifications(page.notifications);
    } catch (failure) {
      if (requestRef.current === requestId) setError(failure instanceof Error ? failure.message : "Notifications could not be loaded. Try again.");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!open) return;
    measure();
    void loadRecent();
    const onResize = () => measure();
    const onScroll = () => measure();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || (triggerRef.current?.contains(target) ?? false) || (panelRef.current?.contains(target) ?? false)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    const focusFrame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("h2")?.focus());
    return () => {
      requestRef.current += 1;
      cancelAnimationFrame(focusFrame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loadRecent, measure]);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("abii:close-notification-popover", close);
    return () => window.removeEventListener("abii:close-notification-popover", close);
  }, []);

  async function markRead(notification: NotificationDTO, navigate: boolean) {
    if (busyId === notification.id) return;
    setBusyId(notification.id);
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
        notifyStateChanged();
      } catch (failure) {
        toast({ kind: "error", title: "Couldn’t update this notification", message: failure instanceof Error ? failure.message : "Try again from the Notification Center." });
      }
    }
    setBusyId(null);
    if (navigate && notification.target) {
      setOpen(false);
      router.push(notification.target);
    }
  }

  async function markAll() {
    if (busyAll || unreadCount === 0) return;
    setBusyAll(true);
    setError("");
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      await refreshUnreadCount();
      notifyStateChanged();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Notifications could not be marked as read.");
    } finally { setBusyAll(false); }
  }

  const countLabel = formatUnreadCount(unreadCount);
  const accessibleLabel = unreadCount && unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";
  const panel = open && mounted ? createPortal(
    <section ref={panelRef} id="notification-popover" role="region" aria-label="Recent notifications" className="notification-panel flex flex-col overflow-hidden rounded-2xl border border-[#E8E2E5] bg-white shadow-[0_16px_48px_rgba(47,41,48,0.16)]" style={{ top: position.top, right: position.right, maxHeight: position.maxHeight }}>
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#F1EAED] px-4 py-3.5">
        <div className="min-w-0"><h2 tabIndex={-1} className="text-[15px] font-semibold tracking-[-0.02em] text-[#18384D] focus-visible:outline-none">Notifications</h2>{unreadCount !== null && unreadCount > 0 && <p className="mt-0.5 text-[11px] text-[#6E879A]">{unreadCount} unread</p>}</div>
        {unreadCount !== null && unreadCount > 0 && <button type="button" disabled={busyAll} onClick={() => void markAll()} className="min-h-9 shrink-0 rounded-lg px-2 text-xs font-semibold text-[#A94369] hover:bg-[#FFF3F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">{busyAll ? "Updating…" : "Mark all as read"}</button>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {error && <div className="m-3 rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-xs leading-5 text-[#A73C50]" role="alert"><p>{error}</p><button type="button" onClick={() => void loadRecent()} className="mt-1 font-semibold underline underline-offset-2">Try again</button></div>}
        {loading ? <div role="status" aria-label="Loading recent notifications" aria-busy="true" className="space-y-3 p-4"><span className="sr-only">Loading notifications…</span>{Array.from({ length: 3 }, (_, index) => <div key={index} aria-hidden="true" className="flex gap-3"><span className="abii-skeleton h-9 w-9 shrink-0 rounded-xl"/><span className="min-w-0 flex-1 space-y-2"><span className="abii-skeleton block h-3 w-2/3 rounded"/><span className="abii-skeleton block h-3 w-full rounded"/></span></div>)}</div>
          : !error && notifications.length === 0 ? <div className="px-5 py-8 text-center"><p className="text-sm font-semibold text-[#18384D]">All caught up!</p><p className="mx-auto mt-1 max-w-[28ch] text-xs leading-5 text-[#63788A]">Nothing new right now. Abii will keep your learning updates here.</p></div>
            : !error && <div className="divide-y divide-[#F3EDF0]">{notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} compact busy={busyId === notification.id} onOpen={(item) => void markRead(item, Boolean(item.target))} onMarkRead={(item) => void markRead(item, false)} />)}</div>}
      </div>
      <footer className="shrink-0 border-t border-[#F1EAED] p-2"><Link href="/notifications" onClick={() => setOpen(false)} aria-label="View all notifications" className="flex min-h-10 items-center justify-center rounded-xl text-sm font-semibold text-[#A94369] transition-colors hover:bg-[#FFF3F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">View all notifications</Link></footer>
    </section>, document.body) : null;

  return <>
    <button ref={triggerRef} type="button" aria-label={accessibleLabel} aria-expanded={open} aria-controls="notification-popover" onClick={() => { window.dispatchEvent(new Event("abii:close-profile-menu")); setOpen((current) => !current); }} className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#708397] transition-colors hover:bg-[#FFF4F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">
      <Bell aria-hidden="true" className="h-[19px] w-[19px]" />
      {countLabel && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex min-h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#E9577D] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">{countLabel}</span>}
    </button>
    {panel ?? <span id="notification-popover" className="sr-only" />}
  </>;
}
