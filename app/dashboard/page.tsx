import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell pageTitle="Dashboard" pageDescription="Your little learning space" userName={user.name}>
      <section className="overflow-hidden rounded-3xl border border-[#F4D6E0] bg-white">
        <div className="bg-[#FFE8EF] px-5 py-7 sm:px-8 sm:py-9">
          <p className="text-sm font-semibold text-[#B83F68]">WELCOME BACK TO ABII ♡</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Hi, {user.name}!</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#756B72] sm:text-base">
            Ready to learn a little and remember a lot? Your study space is ready when you are.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
          <div className="rounded-2xl border border-[#E8E2E5] p-5">
            <span className="text-2xl text-[#E9577D]" aria-hidden="true">▤</span>
            <h3 className="mt-3 font-semibold">Your subjects</h3>
            <p className="mt-1 text-sm leading-5 text-[#756B72]">Organize your learning topics in one place.</p>
            <Link href="/subjects" className="mt-4 inline-flex rounded-lg text-sm font-semibold text-[#C94B76] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">View subjects</Link>
          </div>
          <div className="rounded-2xl border border-[#E8E2E5] p-5">
            <span className="text-2xl text-[#E9577D]" aria-hidden="true">♡</span>
            <h3 className="mt-3 font-semibold">Favorite cards</h3>
            <p className="mt-1 text-sm leading-5 text-[#756B72]">Keep the cards you want to revisit close by.</p>
            <Link href="/favorites" className="mt-4 inline-flex rounded-lg text-sm font-semibold text-[#C94B76] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9577D]">View favorites</Link>
          </div>
        </div>
      </section>
      <p className="mt-5 text-sm text-[#8C7F87]">The learning features will be added in upcoming phases.</p>
    </AppShell>
  );
}
