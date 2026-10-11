import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell pageTitle="Profile" pageDescription="Your Abii account" userName={user.name}>
      <section className="rounded-3xl border border-[#E8E2E5] bg-white p-6 sm:p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFE8EF] text-xl font-bold text-[#B83F68]">
          {user.name?.trim().charAt(0).toUpperCase() || "A"}
        </div>
        <h2 className="mt-4 text-xl font-bold">{user.name}</h2>
        <p className="mt-1 text-sm text-[#756B72]">{user.email}</p>
        <p className="mt-5 max-w-xl text-sm leading-6 text-[#756B72]">This is your account overview. Profile editing will be added in a later phase.</p>
      </section>
    </AppShell>
  );
}
