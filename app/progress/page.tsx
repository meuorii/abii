import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export default async function ProgressPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell pageTitle="Progress" pageDescription="Celebrate each small step" userName={user.name}>
      <section className="rounded-3xl border border-[#E8E2E5] bg-white p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFE8EF] text-2xl text-[#C94B76]" aria-hidden="true">↗</div>
        <h2 className="mt-4 text-xl font-bold">Your progress starts with your first review</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#756B72]">Review totals and learning progress will appear here once review sessions are available.</p>
      </section>
    </AppShell>
  );
}
