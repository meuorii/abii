import type { Metadata } from "next";
import { FeaturesPageContent } from "@/components/landing/features/features-page-content";

export const metadata: Metadata = {
  title: "Features | Abii Active Recall",
  description: "Explore Abii's study tools, including organized workspaces, flashcards, active recall quizzes, progress tracking, and learning achievements.",
};

export default function FeaturesPage() {
  return <FeaturesPageContent />;
}
