"use client";

import { BookOpen } from "lucide-react";

export function FolderAddTopicButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("abii:add-folder-topic"))} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-[#F05B87] px-5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#E9577D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D] focus-visible:ring-offset-2 sm:min-h-11 sm:px-6 sm:text-sm">Add Topic <BookOpen aria-hidden="true" className="h-4 w-4"/></button>;
}
