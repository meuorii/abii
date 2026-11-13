"use client";

import { useEffect, useState } from "react";
import { resolveGreetingTimezone, studyDayGreeting } from "@/lib/badges/study-day";

type DashboardGreetingProps = {
  firstName: string;
  studyTimezone: string;
};

export function DashboardGreeting({ firstName, studyTimezone }: DashboardGreetingProps) {
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const refreshGreeting = () => {
      let browserTimezone: string | undefined;
      try {
        browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        // Fall back to the validated account study timezone below.
      }

      const timezone = resolveGreetingTimezone(browserTimezone, studyTimezone);
      const nextGreeting = studyDayGreeting(new Date(), timezone);
      setGreeting((current) => current === nextGreeting ? current : nextGreeting);
    };

    refreshGreeting();
    const interval = window.setInterval(refreshGreeting, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshGreeting();
    };
    window.addEventListener("focus", refreshGreeting);
    window.addEventListener("pageshow", refreshGreeting);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshGreeting);
      window.removeEventListener("pageshow", refreshGreeting);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [studyTimezone]);

  return (
    <p aria-live="polite" aria-atomic="true" className="text-xs font-medium text-[#2F4658] sm:text-sm">
      {greeting}, {firstName}! <span aria-hidden="true">👋</span>
    </p>
  );
}
