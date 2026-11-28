"use client";

import { BookOpen } from "lucide-react";

export function FolderAddTopicButton({ className = "" }: { className?: string }) {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("abii:add-folder-topic"))} className={`${className} mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2 sm:min-h-11 sm:px-6 sm:text-sm`}>Add Topic <BookOpen aria-hidden="true" className="h-4 w-4"/></button>;
}
