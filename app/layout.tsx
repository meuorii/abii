import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abii — Learn a little, remember a lot",
  description:
    "A calm, friendly study space to practice active recall and remember more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
