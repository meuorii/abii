import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell pageTitle="Favorites" pageDescription="Your saved cards" userName={user.name}>
      <section className="rounded-3xl border border-[#E8E2E5] bg-white p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFE8EF] text-2xl text-[#C94B76]" aria-hidden="true">♡</div>
        <h2 className="mt-4 text-xl font-bold">Your favorite flashcards will appear here</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#756B72]">Mark cards as favorites to make them easier to find and review. Flashcard features will be added in a later phase.</p>
      </section>
    </AppShell>
  );
}
