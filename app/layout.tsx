import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { MotionProvider } from "@/components/motion/motion-provider";

export const metadata: Metadata = {
  title: "Abii — Learn a little, remember a lot",
  description:
    "A calm, friendly study space to practice active recall and remember more.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><MotionProvider><ToastProvider>{children}</ToastProvider></MotionProvider></body>
    </html>
  );
}

