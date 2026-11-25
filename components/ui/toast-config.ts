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
  success: { label: "SUCCESS", icon: CircleCheck, duration: 4500, background: "#EDF5EF", accent: "#5C947A", labelColor: "#3D7259", mascot: "/mascot/toast/Cheerful%20Pink%20Otter%20Thumbs-Up%20Mascot.png" },
  warning: { label: "WARNING", icon: TriangleAlert, duration: 6000, background: "#FBF3E7", accent: "#B28A54", labelColor: "#8A683B", mascot: "/mascot/toast/Cute%20Pink%20Mascot%20with%20Stop%20Paw.png" },
  info: { label: "INFORMATION", icon: Info, duration: 5000, background: "#FFF1F5", accent: "#EC658D", labelColor: "#6F5964", mascot: "/mascot/toast/Friendly%20Pink%20Mascot%20Presenting%20with%20Paw.png" },
  error: { label: "ERROR", icon: CircleX, duration: 7000, background: "#FCECEF", accent: "#C76F7D", labelColor: "#A94D61", mascot: "/mascot/toast/Pastel%20Pink%20Pleading%20Otter%20Mascot.png" },
};
