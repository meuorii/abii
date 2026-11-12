import type { Metadata } from "next";
import { SupportPageContent } from "@/components/landing/support/support-page-content";

export const metadata: Metadata = {
  title: "Support | Abii Active Recall",
  description: "Find Abii help guides, frequently asked questions, and contact support for assistance with your learning experience.",
};

export default function SupportPage() {
  return <SupportPageContent />;
}
