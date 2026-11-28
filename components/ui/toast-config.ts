import { CircleCheck, CircleX, Info, TriangleAlert, type LucideIcon } from "lucide-react";

export type ToastKind = "success" | "warning" | "info" | "error";

export const toastConfig: Record<ToastKind, {
  label: string;
  icon: LucideIcon;
  duration: number;
  background: string;
  accent: string;
  labelColor: string;
  mascot: string;
}> = {
  success: { label: "SUCCESS", icon: CircleCheck, duration: 4500, background: "var(--success-bg)", accent: "var(--success)", labelColor: "var(--success-text)", mascot: "/mascot/toast/Cheerful%20Pink%20Otter%20Thumbs-Up%20Mascot.png" },
  warning: { label: "WARNING", icon: TriangleAlert, duration: 6000, background: "var(--warning-bg)", accent: "var(--warning)", labelColor: "var(--warning-text)", mascot: "/mascot/toast/Cute%20Pink%20Mascot%20with%20Stop%20Paw.png" },
  info: { label: "INFORMATION", icon: Info, duration: 5000, background: "var(--surface-hover)", accent: "var(--primary-hover)", labelColor: "var(--muted)", mascot: "/mascot/toast/Friendly%20Pink%20Mascot%20Presenting%20with%20Paw.png" },
  error: { label: "ERROR", icon: CircleX, duration: 7000, background: "var(--error-bg)", accent: "var(--error)", labelColor: "var(--error-text)", mascot: "/mascot/toast/Pastel%20Pink%20Pleading%20Otter%20Mascot.png" },
};
