import type { Metadata } from "next";
import { AboutPageContent } from "@/components/landing/about/about-page-content";

export const metadata: Metadata = {
  title: "About Abii | Your Friendly Study Buddy",
  description: "Discover why Abii exists, what we believe about learning, and how little moments of practice can lead to meaningful progress.",
};

export default function AboutPage() {
  return <AboutPageContent />;
}
