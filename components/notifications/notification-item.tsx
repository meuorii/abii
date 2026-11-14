"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { NotificationDTO } from "@/lib/notifications/contracts";
import { NOTIFICATION_PRESENTATION } from "./notification-display";

function initialTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function relativeTimestamp(value: string, now: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((date.getTime() - now) / 1000);
  const absolute = Math.abs(seconds);
  const unit: Intl.RelativeTimeFormatUnit = absolute < 60 ? "second" : absolute < 3600 ? "minute" : absolute < 86_400 ? "hour" : "day";
  const amount = unit === "second" ? seconds : unit === "minute" ? Math.round(seconds / 60) : unit === "hour" ? Math.round(seconds / 3600) : Math.round(seconds / 86_400);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(amount, unit);
}

export function NotificationItem({ notification, compact = false, busy = false, onOpen, onMarkRead }: {
  notification: NotificationDTO;
  compact?: boolean;
  busy?: boolean;
  onOpen: (notification: NotificationDTO) => void;
  onMarkRead: (notification: NotificationDTO) => void;
}) {
  const Icon = NOTIFICATION_PRESENTATION[notification.type].icon;
  return (
    <article className={`notification-item flex min-w-0 items-start gap-3 px-3 py-3.5 sm:px-4 ${notification.readAt ? "notification-item--read" : "notification-item--unread"}`}>
      <span aria-hidden="true" className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${notification.readAt ? "bg-[#F6F2F4] text-[#738291]" : "bg-[#FFF0F4] text-[#C94B76]"}`}>
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
      </span>
      {notification.target ? (
      <a href={notification.target} onClick={(event) => { event.preventDefault(); onOpen(notification); }} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">
        <span className="flex min-w-0 items-baseline justify-between gap-2">
          <span className={`min-w-0 truncate text-[13px] text-[#18384D] ${notification.readAt ? "font-medium" : "font-semibold"}`}>{notification.title}</span>
          {!notification.readAt && <span className="sr-only">Unread</span>}
          <time dateTime={notification.createdAt} title={`${new Date(notification.createdAt).toLocaleString("en", { timeZone: "UTC" })} UTC`} className="shrink-0 text-[10px] tabular-nums text-[#768898]" suppressHydrationWarning>
            <Timestamp value={notification.createdAt} initial={initialTimestamp(notification.createdAt)} />
          </time>
        </span>
        <span className={`mt-1 block text-xs leading-[1.45] text-[#5D7181] ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{notification.message}</span>
      </a>
      ) : !notification.readAt ? (
        <button type="button" onClick={() => onOpen(notification)} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2">
          <span className={`block truncate text-[13px] text-[#18384D] ${notification.readAt ? "font-medium" : "font-semibold"}`}>{notification.title}<span className="sr-only">, unread</span></span>
          <span className={`mt-1 block text-xs leading-[1.45] text-[#5D7181] ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{notification.message}</span>
          <time dateTime={notification.createdAt} className="mt-1 block text-[10px] text-[#768898]"><Timestamp value={notification.createdAt} initial={initialTimestamp(notification.createdAt)} /></time>
        </button>
      ) : (
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-[#18384D]">{notification.title}</span>
          <span className={`mt-1 block text-xs leading-[1.45] text-[#5D7181] ${compact ? "line-clamp-2" : "line-clamp-3"}`}>{notification.message}</span>
          <time dateTime={notification.createdAt} className="mt-1 block text-[10px] text-[#768898]"><Timestamp value={notification.createdAt} initial={initialTimestamp(notification.createdAt)} /></time>
        </div>
      )}
      {!notification.readAt && (
        <button type="button" aria-label={`Mark ${notification.title} as read`} disabled={busy} onClick={() => onMarkRead(notification)} className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9A6678] transition-colors hover:bg-[#FFF0F4] hover:text-[#A43D63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] disabled:opacity-50">
          <Check aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </article>
  );
}

function Timestamp({ value, initial }: { value: string; initial: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, [value]);
  return <>{now === null ? initial : relativeTimestamp(value, now)}</>;
}
