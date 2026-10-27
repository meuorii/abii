"use client";

/** Dispatch only after a learning write has been confirmed by its API. */
export const ACHIEVEMENT_ACTIVITY_EVENT = "abii:achievement-activity";
const CHANNEL_NAME = "abii-achievement-sync";
let syncChannel: BroadcastChannel | null = null;

function getChannel() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return null;
  syncChannel ??= new BroadcastChannel(CHANNEL_NAME);
  return syncChannel;
}

export function notifyAchievementActivity() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ACHIEVEMENT_ACTIVITY_EVENT));
    getChannel()?.postMessage({ type: "activity-saved" });
  }
}

export function subscribeToAchievementActivity(onActivity: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ACHIEVEMENT_ACTIVITY_EVENT, onActivity);
  const channel = getChannel();
  const onMessage = (event: MessageEvent<{ type?: string }>) => {
    if (event.data?.type === "activity-saved") onActivity();
  };
  channel?.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener(ACHIEVEMENT_ACTIVITY_EVENT, onActivity);
    channel?.removeEventListener("message", onMessage);
  };
}
