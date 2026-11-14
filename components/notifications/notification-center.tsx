"use client";

import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SkeletonBlock, SkeletonRegion } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import type { NotificationDTO, NotificationGroup } from "@/lib/notifications/contracts";
import { formatUnreadCount, NOTIFICATION_FILTERS, type NotificationFilter } from "./notification-display";
import { fetchNotificationPage, markAllNotificationsRead, markNotificationRead } from "./notification-client";
import { NotificationItem } from "./notification-item";
import { notifyStateChanged, useNotifications } from "./notification-context";

const groupByFilter: Partial<Record<NotificationFilter, NotificationGroup>> = {
  reminders: "reminders", achievements: "achievements", system: "system",
};

function dateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function getDateLabel(value: string, timezone: string, now: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = dateKey(now, timezone);
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  const key = dateKey(date, timezone);
  if (key === today) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  return "Earlier";
}

function EmptyState({ filter }: { filter: NotificationFilter }) {
  const title = filter === "unread" ? "No unread notifications" : "All caught up!";
  const message = filter === "unread" ? "You’ve read everything here." : filter === "all" ? "Nothing new right now. Abii will keep your learning updates here." : `No ${filter} notifications yet.`;
  return <div className="flex min-h-[250px] flex-col items-center justify-center px-5 py-10 text-center"><span aria-hidden="true" className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF0F4] text-[#C94B76]"><Bell className="h-6 w-6" strokeWidth={1.8}/></span><h2 className="text-base font-semibold text-[#18384D]">{title}</h2><p className="mt-1 max-w-[34ch] text-sm leading-6 text-[#647A8B]">{message}</p></div>;
}

function ListSkeleton() {
  return <SkeletonRegion label="Loading notifications" className="divide-y divide-[#F3EDF0]">
    {Array.from({ length: 4 }, (_, index) => <div key={index} aria-hidden="true" className="flex gap-3 px-4 py-4"><SkeletonBlock className="h-10 w-10 shrink-0 rounded-xl"/><div className="min-w-0 flex-1 space-y-2"><SkeletonBlock className="h-3.5 w-2/5 rounded"/><SkeletonBlock className="h-3 w-4/5 rounded"/><SkeletonBlock className="h-3 w-2/3 rounded"/></div></div>)}
  </SkeletonRegion>;
}

export function NotificationCenter() {
  const router = useRouter();
  const { toast } = useToast();
  const { unreadCount, studyTimezone, refreshUnreadCount } = useNotifications();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [moreError, setMoreError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const requestGeneration = useRef(0);

  const loadPage = useCallback(async (currentFilter: NotificationFilter, append = false, pageCursor?: string) => {
    const generation = append ? requestGeneration.current : ++requestGeneration.current;
    if (append) { setLoadingMore(true); setMoreError(""); }
    else { setLoading(true); setLoadingMore(false); setError(""); setMoreError(""); setItems([]); setCursor(null); }
    try {
      const page = await fetchNotificationPage({ limit: 20, ...(currentFilter === "unread" ? { unreadOnly: true } : {}), ...(groupByFilter[currentFilter] ? { group: groupByFilter[currentFilter] } : {}), ...(pageCursor ? { cursor: pageCursor } : {}) });
      if (generation !== requestGeneration.current) return;
      setItems((current) => {
        if (!append) return page.notifications;
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.notifications.filter((item) => !known.has(item.id))];
      });
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Notifications could not be loaded. Try again.";
      if (generation === requestGeneration.current) { if (append) setMoreError(message); else setError(message); }
    } finally {
      if (generation === requestGeneration.current) { if (append) setLoadingMore(false); else setLoading(false); }
    }
  }, []);

  useEffect(() => { void loadPage(filter); }, [filter, reloadToken, loadPage]);
  useEffect(() => {
    const onChanged = () => setReloadToken((token) => token + 1);
    window.addEventListener("abii:notifications-changed", onChanged);
    return () => window.removeEventListener("abii:notifications-changed", onChanged);
  }, []);

  async function openNotification(notification: NotificationDTO) {
    if (notification.readAt) {
      if (notification.target) router.push(notification.target);
      return;
    }
    setBusyId(notification.id);
    try {
      await markNotificationRead(notification.id);
      setItems((current) => filter === "unread" ? current.filter((item) => item.id !== notification.id) : current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      await refreshUnreadCount();
      notifyStateChanged();
    } catch (failure) {
      toast({ kind: "error", title: "Couldn’t update this notification", message: failure instanceof Error ? failure.message : "It will stay unread. Try again." });
    } finally { setBusyId(null); }
    if (notification.target) router.push(notification.target);
  }

  async function markRead(notification: NotificationDTO) {
    if (busyId === notification.id) return;
    setBusyId(notification.id);
    try {
      await markNotificationRead(notification.id);
      setItems((current) => filter === "unread" ? current.filter((item) => item.id !== notification.id) : current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
      await refreshUnreadCount();
      notifyStateChanged();
    } catch (failure) { toast({ kind: "error", title: "Couldn’t update this notification", message: failure instanceof Error ? failure.message : "Try again." }); }
    finally { setBusyId(null); }
  }

  async function markAll() {
    if (savingAll || unreadCount === 0) return;
    setSavingAll(true);
    try {
      await markAllNotificationsRead();
      const readAt = new Date().toISOString();
      setItems((current) => filter === "unread" ? [] : current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
      if (filter === "unread") { setCursor(null); setHasMore(false); }
      await refreshUnreadCount();
      notifyStateChanged();
    } catch (failure) { toast({ kind: "error", title: "Couldn’t mark notifications as read", message: failure instanceof Error ? failure.message : "Try again." }); }
    finally { setSavingAll(false); }
  }

  const groupedItems = useMemo(() => {
    const now = new Date();
    const groups = new Map<string, NotificationDTO[]>();
    for (const item of items) {
      const label = getDateLabel(item.createdAt, studyTimezone, now);
      const current = groups.get(label) ?? [];
      current.push(item);
      groups.set(label, current);
    }
    return ["Today", "Yesterday", "Earlier"].flatMap((label) => groups.has(label) ? [[label, groups.get(label)!] as const] : []);
  }, [items, studyTimezone]);

  const badgeCount = formatUnreadCount(unreadCount);
  return <div className="mx-auto w-full min-w-0 space-y-5 p-4 sm:space-y-6 sm:p-6 xl:px-6 xl:py-7">
    <header className="flex min-w-0 items-center gap-4 rounded-2xl border border-[#F2E6EB] bg-[#FFF7F9] px-4 py-5 sm:px-6 sm:py-6">
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#C94B76] shadow-[0_2px_8px_rgba(47,41,48,0.05)]"><Bell className="h-5 w-5" strokeWidth={1.9}/></span>
      <div className="min-w-0 flex-1"><h1 className="text-[23px] font-bold leading-tight tracking-[-0.035em] text-[#18384D] sm:text-[27px]">Your Notifications</h1><p className="mt-1 text-sm leading-5 text-[#647A8B]">Learning updates and reminders, all in one place.</p></div>
      {unreadCount !== null && unreadCount > 0 && <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#A94369]">{badgeCount} unread</span>}
    </header>

    <section aria-label="Notification history" className="overflow-hidden rounded-2xl border border-[#E8E2E5] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#F1EAED] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div role="group" aria-label="Notification filters" className="flex min-w-0 gap-1 overflow-x-auto pb-0.5">
          {NOTIFICATION_FILTERS.map((option) => <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)} className={`min-h-10 shrink-0 rounded-xl px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] ${filter === option.id ? "bg-[#FFE8EF] text-[#A94369]" : "text-[#657B8E] hover:bg-[#FFF7F9]"}`}>{option.label}</button>)}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs tabular-nums text-[#6E8291]">{unreadCount === null ? "" : `${unreadCount} unread`}</span>
          {unreadCount !== null && unreadCount > 0 && <button type="button" disabled={savingAll} onClick={() => void markAll()} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#A94369] hover:bg-[#FFF3F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50"><CheckCheck className="h-4 w-4" aria-hidden="true"/>{savingAll ? "Updating…" : "Mark all as read"}</button>}
        </div>
      </div>

      {loading ? <ListSkeleton/> : error ? <div className="px-5 py-12 text-center"><p role="alert" className="text-sm text-[#A73C50]">{error}</p><button type="button" onClick={() => void loadPage(filter)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E8E2E5] px-3 text-sm font-semibold text-[#A94369] hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]"><RefreshCw className="h-4 w-4" aria-hidden="true"/>Try again</button></div>
        : items.length === 0 ? <EmptyState filter={filter}/>
          : <div>{groupedItems.map(([label, rows]) => <section key={label} aria-label={label}><h2 className="border-b border-[#F4EDF0] bg-[#FFFCFD] px-4 py-2.5 text-xs font-semibold text-[#61798B]">{label}</h2><div className="divide-y divide-[#F3EDF0]">{rows.map((notification) => <NotificationItem key={notification.id} notification={notification} busy={busyId === notification.id} onOpen={(item) => void openNotification(item)} onMarkRead={(item) => void markRead(item)}/>)}</div></section>)}</div>}
      {moreError && <div role="alert" className="mx-4 my-3 rounded-xl bg-[#FFF1F1] px-3 py-2.5 text-sm text-[#A73C50]">{moreError}</div>}
      {hasMore && !loading && !error && <div className="border-t border-[#F1EAED] px-4 py-3 text-center"><button type="button" disabled={loadingMore || !cursor} onClick={() => cursor && void loadPage(filter, true, cursor)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E8E2E5] bg-white px-4 text-sm font-semibold text-[#536A7D] transition-colors hover:bg-[#FFF7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-60">{loadingMore ? <><span aria-hidden="true" className="abii-skeleton h-3 w-3 rounded-full"/>Loading more</> : "Load more"}</button></div>}
    </section>
  </div>;
}
