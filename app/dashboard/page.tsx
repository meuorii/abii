import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";

export const runtime = "nodejs";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <main className="min-h-screen bg-pink-soft px-4 py-10">
    <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-white p-6 shadow-sm sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-pink-active">ABII · YOUR STUDY SPACE</p><h1 className="mt-2 text-3xl font-bold">Hi, {user.name}!</h1><p className="mt-2 text-muted">You’re signed in. Your study dashboard will grow here in a later phase.</p></div>
        <LogoutButton />
      </div>
      <div className="mt-8 rounded-2xl bg-pink-card p-5"><h2 className="font-semibold">Ready for a little review?</h2><p className="mt-1 text-sm text-muted">Subjects, flashcards, and review sessions will be added in upcoming phases.</p></div>
      <Link href="/design-system" className="mt-6 inline-block text-sm font-semibold text-pink-active underline">View the design system demo</Link>
    </div>
  </main>;
}
