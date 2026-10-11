import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export default async function SubjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell pageTitle="Subjects" pageDescription="Keep your study topics organized" userName={user.name}>
      <section className="rounded-3xl border border-[#E8E2E5] bg-white p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFE8EF] text-2xl text-[#C94B76]" aria-hidden="true">▤</div>
        <h2 className="mt-4 text-xl font-bold">Your subjects will live here</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#756B72]">Create subjects to organize flashcards by class, topic, or anything you are learning. Subject management is coming in a later phase.</p>
      </section>
    </AppShell>
  );
}
