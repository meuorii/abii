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
  success: { label: "SUCCESS", icon: CircleCheck, duration: 4500, background: "#EAF8F0", accent: "#35C995", labelColor: "#28B987", mascot: "/mascot/toast/Cheerful%20Pink%20Otter%20Thumbs-Up%20Mascot.png" },
  warning: { label: "WARNING", icon: TriangleAlert, duration: 6000, background: "#FFF8EE", accent: "#FFAE19", labelColor: "#E99100", mascot: "/mascot/toast/Cute%20Pink%20Mascot%20with%20Stop%20Paw.png" },
  info: { label: "INFORMATION", icon: Info, duration: 5000, background: "#FFF7F9", accent: "#FF5FA2", labelColor: "#E95791", mascot: "/mascot/toast/Friendly%20Pink%20Mascot%20Presenting%20with%20Paw.png" },
  error: { label: "ERROR", icon: CircleX, duration: 7000, background: "#FFF1F1", accent: "#FF426B", labelColor: "#F23863", mascot: "/mascot/toast/Pastel%20Pink%20Pleading%20Otter%20Mascot.png" },
};
