import type { Metadata } from "next";
import { BlogsPageContent } from "@/components/landing/blogs/blogs-page-content";

export const metadata: Metadata = {
  title: "Blogs | Abii Active Recall",
  description: "Explore study tips, active recall techniques, learning habits, and thoughtful student-life stories from Abii.",
};

export default function BlogsPage() {
  return <BlogsPageContent />;
}
