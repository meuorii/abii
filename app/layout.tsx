import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import { cuteDino, onest } from "./fonts";

export const metadata: Metadata = {
  title: "Abii — Active Recall Study App",
  description:
    "Make flashcards, test your knowledge, and see what needs another review with Abii.",
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
    <html lang="en" className={`${cuteDino.variable} ${onest.variable}`}>
      <body><MotionProvider><ToastProvider>{children}</ToastProvider></MotionProvider></body>
    </html>
  );
}

