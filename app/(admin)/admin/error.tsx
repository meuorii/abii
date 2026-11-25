"use client";

import { Button } from "@/components/ui/button";
import { AdminPanel } from "@/components/admin/admin-ui";

export default function AdminPageError({ reset }: { reset: () => void }) {
  return <AdminPanel title="This page could not load"><p role="alert" className="mb-4 text-sm text-[#6F5964]">Try loading the page again.</p><Button onClick={reset}>Try again</Button></AdminPanel>;
}
